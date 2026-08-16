/**
 * Presets CRUD — user-owned prompt/model presets stored as JSONB.
 * @module presets
 * @description GET/POST /api/presets, GET/PATCH/DELETE /api/presets/:id. All routes require Better Auth session.
 * @see docs/billing.md
 */
import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { presets } from '../db/schema.js';
import { auth } from '../lib/auth.js';

const app = new OpenAPIHono();

async function getUserId(c: any): Promise<string | null> {
  try {
    const sess = await auth.api.getSession({ headers: c.req.raw.headers as any });
    return (sess as any)?.user?.id ?? null;
  } catch { return null; }
}

const presetSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  data: z.record(z.any()),
  createdAt: z.string(),
}).openapi('Preset');

const createBody = z.object({
  title: z.string().min(1).max(200).openapi({ example: 'My preset' }),
  data: z.record(z.any()).openapi({ example: { model: 'qwen-plus', temperature: 0.7 } }),
});

const patchBody = z.object({
  title: z.string().min(1).max(200).optional(),
  data: z.record(z.any()).optional(),
});

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['presets'],
  summary: 'List presets for current user',
  security: [{ Bearer: [] }],
  responses: {
    200: { description: 'Presets', content: { 'application/json': { schema: z.array(presetSchema) } } },
    401: { description: 'Unauthorized' },
  },
});

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['presets'],
  summary: 'Create preset',
  security: [{ Bearer: [] }],
  request: { body: { content: { 'application/json': { schema: createBody } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: presetSchema } } },
    401: { description: 'Unauthorized' },
  },
});

const getOneRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['presets'],
  summary: 'Get preset by id',
  security: [{ Bearer: [] }],
  request: { params: z.object({ id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }) }) },
  responses: {
    200: { description: 'Preset', content: { 'application/json': { schema: presetSchema } } },
    401: { description: 'Unauthorized' },
    404: { description: 'Not found' },
  },
});

const patchRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['presets'],
  summary: 'Update preset',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({ id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: { content: { 'application/json': { schema: patchBody } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: presetSchema } } },
    401: { description: 'Unauthorized' },
    404: { description: 'Not found' },
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['presets'],
  summary: 'Delete preset',
  security: [{ Bearer: [] }],
  request: { params: z.object({ id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }) }) },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } } },
    401: { description: 'Unauthorized' },
    404: { description: 'Not found' },
  },
});

app.openapi(listRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await db.query.presets.findMany({ where: eq(presets.userId, userId), orderBy: [desc(presets.createdAt)], limit: 100 });
  return c.json(rows.map(r => ({ ...r, createdAt: (r.createdAt as Date).toISOString() })));
});

app.openapi(createRouteDef, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const { title, data } = c.req.valid('json');
  const [row] = await db.insert(presets).values({ userId, title, data }).returning();
  return c.json({ ...row, createdAt: (row.createdAt as Date).toISOString() }, 201);
});

app.openapi(getOneRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const row = await db.query.presets.findFirst({ where: and(eq(presets.id, id), eq(presets.userId, userId)) });
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ ...row, createdAt: (row.createdAt as Date).toISOString() });
});

app.openapi(patchRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const existing = await db.query.presets.findFirst({ where: and(eq(presets.id, id), eq(presets.userId, userId)) });
  if (!existing) return c.json({ error: 'Not found' }, 404);
  const body = c.req.valid('json');
  const update: Record<string, any> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.data !== undefined) update.data = body.data;
  if (Object.keys(update).length === 0) return c.json({ ...existing, createdAt: (existing.createdAt as Date).toISOString() });
  const [row] = await db.update(presets).set(update).where(eq(presets.id, id)).returning();
  return c.json({ ...row, createdAt: (row.createdAt as Date).toISOString() });
});

app.openapi(deleteRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const existing = await db.query.presets.findFirst({ where: and(eq(presets.id, id), eq(presets.userId, userId)) });
  if (!existing) return c.json({ error: 'Not found' }, 404);
  await db.delete(presets).where(eq(presets.id, id));
  return c.json({ ok: true });
});

export default app;
