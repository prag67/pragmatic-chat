import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { messages, conversations, balances, transactions } from '../db/schema.js';
import { auth } from '../lib/auth.js';
import { env } from '../lib/env.js';

const app = new OpenAPIHono();

async function getUserId(c: any): Promise<string | null> {
  try {
    const sess = await auth.api.getSession({ headers: c.req.raw.headers });
    return (sess as any)?.user?.id ?? null;
  } catch { return null; }
}


async function deductCredits(userId: string, amount: number, reason: string){
  let bal = await db.query.balances.findFirst({ where: eq(balances.userId, userId) });
  if(!bal){ const [nb] = await db.insert(balances).values({ userId, tokenCredits: 0 }).returning(); bal = nb; }
  const newVal = (bal.tokenCredits ?? 0) + amount;
  await db.update(balances).set({ tokenCredits: newVal, updatedAt: new Date() }).where(eq(balances.userId, userId));
  await db.insert(transactions).values({ userId, amount, type: amount<0 ? 'usage' : 'topup', reason }).catch(()=>{});
  return newVal;
}

const createMessageRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['messages'],
  request: {
    body: { content: { 'application/json': { schema: z.object({
      conversationId: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
      role: z.enum(['user','assistant','system']).openapi({ example: 'user' }),
      content: z.string().min(1).openapi({ example: 'Hello' }),
      model: z.string().optional().openapi({ example: 'qwen-plus' }),
      stream: z.boolean().optional().default(false),
    }) } } },
  },
  responses: { 201: { description: 'Created' }, 401: { description: 'Unauthorized' }, 404: { description: 'Conversation not found' } },
});

const chatCompletionsRoute = createRoute({
  method: 'post',
  path: '/chat/completions',
  tags: ['messages'],
  request: {
    body: { content: { 'application/json': { schema: z.object({
      model: z.string().openapi({ example: 'qwen-plus' }),
      messages: z.array(z.object({ role: z.string(), content: z.string() })),
      stream: z.boolean().optional(),
      temperature: z.number().optional(),
      conversationId: z.string().uuid().optional(),
    }).passthrough() } } },
  },
  responses: {
    200: { description: 'SSE stream or JSON', content: { 'text/event-stream': { schema: z.string() }, 'application/json': { schema: z.object({}).passthrough() } } },
    401: { description: 'Unauthorized' },
  },
});

app.openapi(createMessageRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const { conversationId, role, content, model } = c.req.valid('json');
  const convo = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  if (!convo || convo.userId !== userId) return c.json({ error: 'Conversation not found' }, 404);
  const [msg] = await db.insert(messages).values({ conversationId, userId, role, content, model }).returning();
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  return c.json(msg, 201);
});

app.openapi(chatCompletionsRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();

  // If conversationId supplied, ensure ownership
  if (body.conversationId) {
    const convo = await db.query.conversations.findFirst({ where: eq(conversations.id, body.conversationId) });
    if (!convo || convo.userId !== userId) return c.json({ error: 'Conversation not found' }, 404);
  }

  const upstream = env.QWEN_PROXY_URL || 'http://localhost:8081';
  const dashKey = process.env.DASHSCOPE_API_KEY || '';

  // Persist user message if conversationId present and last message is user
  let assistantMessageId: string | null = null;
  if (body.conversationId && Array.isArray(body.messages)) {
    const last = body.messages[body.messages.length - 1];
    if (last?.role === 'user' && typeof last.content === 'string') {
      const [m] = await db.insert(messages).values({ conversationId: body.conversationId, userId, role: 'user', content: last.content, model: body.model }).returning();
      await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, body.conversationId));
      // prepare assistant placeholder for streaming
      const [a] = await db.insert(messages).values({ conversationId: body.conversationId, userId, role: 'assistant', content: '', model: body.model }).returning();
      assistantMessageId = a.id;
    }
  }

  const upstreamRes = await fetch(`${upstream}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dashKey}` },
    body: JSON.stringify(body),
  });

  if (!upstreamRes.ok || !upstreamRes.body) {
    const text = await upstreamRes.text().catch(() => '');
    return c.json({ error: 'Upstream error', details: text, status: upstreamRes.status }, 502);
  }

  const isStream = body.stream === true;

  if (!isStream) {
    const data = await upstreamRes.json() as any;
    const content = data?.choices?.[0]?.message?.content ?? '';
    if (assistantMessageId && content) {
      await db.update(messages).set({ content }).where(eq(messages.id, assistantMessageId));
    }
    const tokens = Math.ceil((content?.length || 0)/4) || 1;
    await deductCredits(userId, -Math.max(1, Math.min(1000, tokens)), 'chat non-stream ' + (body.model || 'qwen')).catch(()=>{});
    return c.json(data, upstreamRes.status as any);
  }

  // Streaming SSE proxy -> also accumulate for persistence
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstreamRes.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          controller.enqueue(value);
        }
      } finally {
        controller.close();
        if (assistantMessageId) {
          // Extract content from SSE chunks (naive)
          let text = '';
          const lines = accumulated.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const d = line.slice(6).trim();
              if (d === '[DONE]') continue;
              try { const j = JSON.parse(d); const delta = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? ''; if (delta) text += delta; } catch {}
            }
          }
          if (assistantMessageId && text) { await db.update(messages).set({ content: text }).where(eq(messages.id, assistantMessageId!)).catch(()=>{}); await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, body.conversationId!)).catch(()=>{}); }
          const est = Math.ceil(((text || accumulated)?.length || 0)/4) || 1;
          await deductCredits(userId, -Math.max(1, Math.min(2000, est)), 'chat stream ' + (body.model || 'qwen')).catch(()=>{});
        }
      }
    },
  });

  return new Response(stream, {
    status: upstreamRes.status,
    headers: {
      'Content-Type': upstreamRes.headers.get('content-type') || 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

export default app;
