import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { conversations, messages } from '../db/schema.js';
import { auth } from '../lib/auth.js';

const app = new OpenAPIHono();

async function requireUserId(c: any): Promise<string | null> {
  const session = await auth.api.getSession({ headers: c.req.header() ? Object.fromEntries(Object.entries(c.req.header())) : c.req.raw.headers });
  // fallback: use raw headers
  const headers = c.req.raw.headers as Headers;
  const s = await auth.api.getSession({ headers });
  return (s as any)?.user?.id ?? null;
}

async function getUserIdFromReq(c: any): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    return (session as any)?.user?.id ?? null;
  } catch { return null; }
}

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['conversations'],
  security: [{ Bearer: [] }],
  responses: {
    200: { description: 'List conversations', content: { 'application/json': { schema: z.array(z.object({ id: z.string().uuid(), title: z.string().nullable(), model: z.string().nullable(), endpoint: z.string().nullable(), createdAt: z.string(), updatedAt: z.string() }).openapi('Conversation')) } } },
    401: { description: 'Unauthorized' },
  },
});

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['conversations'],
  request: {
    body: { content: { 'application/json': { schema: z.object({ title: z.string().max(500).optional().openapi({ example: 'New chat' }), model: z.string().optional().openapi({ example: 'qwen-plus' }), endpoint: z.string().optional() }) } } },
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: z.object({ id: z.string().uuid(), title: z.string().nullable(), model: z.string().nullable() }) } } },
    401: { description: 'Unauthorized' },
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['conversations'],
  request: { params: z.object({ id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }) }) },
  responses: {
    200: { description: 'Conversation with messages' },
    404: { description: 'Not found' },
    401: { description: 'Unauthorized' },
  },
});

const patchRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['conversations'],
  request: {
    params: z.object({ id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: { content: { 'application/json': { schema: z.object({ title: z.string().max(500).optional() }) } } },
  },
  responses: { 200: { description: 'Updated' }, 401: { description: 'Unauthorized' } },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['conversations'],
  request: { params: z.object({ id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }) }) },
  responses: { 200: { description: 'Deleted' }, 401: { description: 'Unauthorized' } },
});

app.openapi(listRoute, async (c) => {
  const userId = await getUserIdFromReq(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await db.query.conversations.findMany({ where: eq(conversations.userId, userId), orderBy: [desc(conversations.updatedAt)], limit: 100 });
  return c.json(rows);
});

app.openapi(createRouteDef, async (c) => {
  const userId = await getUserIdFromReq(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const { title, model, endpoint } = c.req.valid('json');
  const [row] = await db.insert(conversations).values({ userId, title: title || 'New chat', model, endpoint }).returning();
  return c.json(row, 201);
});

app.openapi(getRoute, async (c) => {
  const userId = await getUserIdFromReq(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const convo = await db.query.conversations.findFirst({ where: eq(conversations.id, id) });
  if (!convo || convo.userId !== userId) return c.json({ error: 'Not found' }, 404);
  const msgs = await db.query.messages.findMany({ where: eq(messages.conversationId, id), orderBy: messages.createdAt });
  return c.json({ ...convo, messages: msgs });
});

app.openapi(patchRoute, async (c) => {
  const userId = await getUserIdFromReq(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const convo = await db.query.conversations.findFirst({ where: eq(conversations.id, id) });
  if (!convo || convo.userId !== userId) return c.json({ error: 'Not found' }, 404);
  const { title } = c.req.valid('json');
  const [updated] = await db.update(conversations).set({ title, updatedAt: new Date() }).where(eq(conversations.id, id)).returning();
  return c.json(updated);
});

app.openapi(deleteRoute, async (c) => {
  const userId = await getUserIdFromReq(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const convo = await db.query.conversations.findFirst({ where: eq(conversations.id, id) });
  if (!convo || convo.userId !== userId) return c.json({ error: 'Not found' }, 404);
  await db.delete(conversations).where(eq(conversations.id, id));
  return c.json({ ok: true });
});

export default app;
