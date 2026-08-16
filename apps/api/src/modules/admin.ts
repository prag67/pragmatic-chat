/**
 * Admin — user listing and balance adjustments, requires role=admin.
 * @module admin
 */
import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user, balances, transactions } from '../db/schema.js';
import { auth } from '../lib/auth.js';

const app = new OpenAPIHono();

async function getSession(c: any){
  try { return await auth.api.getSession({ headers: c.req.raw.headers as any }); } catch { return null; }
}
async function requireAdmin(c: any){
  const sess: any = await getSession(c);
  const u = sess?.user;
  if(!u) return { err: c.json({ error: 'Unauthorized' }, 401) as any, user: null };
  // fetch fresh role from DB (better-auth session may be stale)
  const row = await db.query.user.findFirst({ where: eq(user.id, u.id) });
  if(!row || row.role !== 'admin') return { err: c.json({ error: 'Forbidden — admin only' }, 403) as any, user: null };
  return { err: null, user: row };
}

const listUsersRoute = createRoute({
  method: 'get',
  path: '/users',
  tags: ['admin'],
  summary: 'List users (admin)',
  responses: {
    200: { description: 'Users', content: { 'application/json': { schema: z.array(z.object({ id: z.string(), email: z.string(), name: z.string(), role: z.string(), createdAt: z.string() })) } } },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
  },
});

const adjustBalanceRoute = createRoute({
  method: 'post',
  path: '/balances/adjust',
  tags: ['admin'],
  summary: 'Adjust user balance (admin)',
  request: { body: { content: { 'application/json': { schema: z.object({ userId: z.string().uuid(), amount: z.number().int().min(-100000).max(100000), reason: z.string().max(200).optional() }) } } } },
  responses: {
    200: { description: 'New balance', content: { 'application/json': { schema: z.object({ userId: z.string(), tokenCredits: z.number() }) } } },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'User not found' },
  },
});

const getUserBalanceRoute = createRoute({
  method: 'get',
  path: '/balances/{userId}',
  tags: ['admin'],
  summary: 'Get user balance (admin)',
  request: { params: z.object({ userId: z.string().uuid().openapi({ param: { name: 'userId', in: 'path' } }) }) },
  responses: {
    200: { description: 'Balance', content: { 'application/json': { schema: z.object({ userId: z.string(), tokenCredits: z.number(), updatedAt: z.string() }) } } },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'Not found' },
  },
});

app.openapi(listUsersRoute, async (c) => {
  const chk = await requireAdmin(c);
  if(chk.err) return chk.err;
  const rows = await db.query.user.findMany({ orderBy: [desc(user.createdAt)], limit: 100 });
  return c.json(rows.map(r=> ({ id: r.id, email: r.email, name: r.name, role: r.role, createdAt: (r.createdAt as Date).toISOString() })));
});

app.openapi(adjustBalanceRoute, async (c) => {
  const chk = await requireAdmin(c);
  if(chk.err) return chk.err;
  const { userId, amount, reason } = c.req.valid('json');
  const u = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if(!u) return c.json({ error: 'User not found' }, 404);
  // ensure balance row exists
  let bal = await db.query.balances.findFirst({ where: eq(balances.userId, userId) });
  if(!bal){
    const [nb] = await db.insert(balances).values({ userId, tokenCredits: 0 }).returning();
    bal = nb;
  }
  const newCredits = (bal.tokenCredits ?? 0) + amount;
  const [updated] = await db.update(balances).set({ tokenCredits: newCredits, updatedAt: new Date() }).where(eq(balances.userId, userId)).returning();
  await db.insert(transactions).values({ userId, amount, type: amount >=0 ? 'admin_topup' : 'admin_deduct', reason: reason || 'admin adjust' });
  return c.json({ userId, tokenCredits: updated.tokenCredits });
});

app.openapi(getUserBalanceRoute, async (c) => {
  const chk = await requireAdmin(c);
  if(chk.err) return chk.err;
  const userId = c.req.param('userId');
  const bal = await db.query.balances.findFirst({ where: eq(balances.userId, userId) });
  if(!bal) return c.json({ error: 'Not found' }, 404);
  return c.json({ userId: bal.userId, tokenCredits: bal.tokenCredits, updatedAt: (bal.updatedAt as Date).toISOString() });
});

export default app;
