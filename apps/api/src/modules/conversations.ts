import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { conversations, messages } from '../db/schema.js';
import { verifyToken } from '../lib/auth.js';

const r = new Hono();

function getUserId(c: any): string | null {
  const auth = c.req.header('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try { const p: any = verifyToken(auth.slice(7)); return p.sub; } catch { return null; }
}

r.get('/', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await db.query.conversations.findMany({ where: eq(conversations.userId, userId), orderBy: [desc(conversations.updatedAt)], limit: 100 });
  return c.json(rows);
});

r.post('/', zValidator('json', z.object({ title: z.string().max(500).optional(), model: z.string().optional() })), async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const { title, model } = c.req.valid('json');
  const [row] = await db.insert(conversations).values({ userId, title: title || 'New chat', model }).returning();
  return c.json(row, 201);
});

r.get('/:id', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const convo = await db.query.conversations.findFirst({ where: eq(conversations.id, id) });
  if (!convo || convo.userId !== userId) return c.json({ error: 'Not found' }, 404);
  const msgs = await db.query.messages.findMany({ where: eq(messages.conversationId, id), orderBy: messages.createdAt });
  return c.json({ ...convo, messages: msgs });
});

r.patch('/:id', zValidator('json', z.object({ title: z.string().max(500).optional() })), async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const { title } = c.req.valid('json');
  const [updated] = await db.update(conversations).set({ title, updatedAt: new Date() }).where(eq(conversations.id, id)).returning();
  return c.json(updated);
});

r.delete('/:id', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  await db.delete(conversations).where(eq(conversations.id, id));
  return c.json({ ok: true });
});

export default r;
