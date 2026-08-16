import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { messages, conversations } from '../db/schema.js';
import { verifyToken } from '../lib/auth.js';

const r = new Hono();
function getUserId(c: any): string | null {
  const h = c.req.header('authorization');
  if (!h?.startsWith('Bearer ')) return null;
  try { const p: any = verifyToken(h.slice(7)); return p.sub; } catch { return null; }
}

// POST /api/messages - append message, optionally proxy to LLM via qwen-proxy
r.post('/', zValidator('json', z.object({
  conversationId: z.string().uuid(),
  role: z.enum(['user','assistant','system']),
  content: z.string().min(1),
  model: z.string().optional(),
  stream: z.boolean().optional().default(false),
})), async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const { conversationId, role, content, model } = c.req.valid('json');
  const convo = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  if (!convo || convo.userId !== userId) return c.json({ error: 'Conversation not found' }, 404);
  const [msg] = await db.insert(messages).values({ conversationId, userId, role, content, model }).returning();
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));

  // If stream requested and role=user, proxy to LLM (via qwen-proxy OpenAI compat)
  // For now just echo; streaming implementation calls UPSTREAM
  return c.json(msg, 201);
});

// SSE streaming chat completion (Hono streams via OpenAI compat passthrough)
r.post('/chat/completions', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const upstream = process.env.QWEN_PROXY_URL || 'http://qwen-proxy:8081';
  const res = await fetch(`${upstream}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY || ''}` },
    body: JSON.stringify(body),
  });
  // passthrough stream
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'text/event-stream', 'Cache-Control': 'no-cache' } });
});

export default r;
