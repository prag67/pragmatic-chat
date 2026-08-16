/**
 * Balances & transactions — credits per user.
 * @module balances
 * @description GET /api/balances/me returns current tokenCredits (auto-creates 0). GET /api/balances/transactions lists history.
 * @see docs/billing.md
 */
import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { balances, transactions } from '../db/schema.js';
import { auth } from '../lib/auth.js';

const app = new OpenAPIHono();

async function getUserId(c: any): Promise<string | null> {
  try {
    const sess = await auth.api.getSession({ headers: c.req.raw.headers as any });
    return (sess as any)?.user?.id ?? null;
  } catch { return null; }
}

const balanceSchema = z.object({
  userId: z.string().uuid(),
  tokenCredits: z.number(),
  updatedAt: z.string(),
}).openapi('Balance');

const transactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number(),
  type: z.string(),
  reason: z.string().nullable(),
  createdAt: z.string(),
}).openapi('Transaction');

const getMeRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['balances'],
  summary: 'Get current user balance',
  security: [{ Bearer: [] }],
  responses: {
    200: { description: 'Balance', content: { 'application/json': { schema: balanceSchema } } },
    401: { description: 'Unauthorized' },
  },
});

const getRootRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['balances'],
  summary: 'Get current user balance (alias for /me)',
  security: [{ Bearer: [] }],
  responses: {
    200: { description: 'Balance', content: { 'application/json': { schema: balanceSchema } } },
    401: { description: 'Unauthorized' },
  },
});

const getTransactionsRoute = createRoute({
  method: 'get',
  path: '/transactions',
  tags: ['balances'],
  summary: 'List transactions for current user',
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(50).openapi({ param: { name: 'limit', in: 'query' } }),
      offset: z.coerce.number().int().min(0).optional().default(0).openapi({ param: { name: 'offset', in: 'query' } }),
    }),
  },
  responses: {
    200: { description: 'Transactions', content: { 'application/json': { schema: z.array(transactionSchema) } } },
    401: { description: 'Unauthorized' },
  },
});

async function ensureBalance(userId: string) {
  const existing = await db.query.balances.findFirst({ where: eq(balances.userId, userId) });
  if (existing) return existing;
  const [row] = await db.insert(balances).values({ userId, tokenCredits: 0 }).returning();
  return row;
}

async function handleGetBalance(c: any) {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const row = await ensureBalance(userId);
  return c.json({ userId: row.userId, tokenCredits: row.tokenCredits, updatedAt: (row.updatedAt as Date).toISOString() });
}

app.openapi(getMeRoute, handleGetBalance);
app.openapi(getRootRoute, handleGetBalance);

app.openapi(getTransactionsRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const { limit, offset } = c.req.valid('query');
  const rows = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
    orderBy: [desc(transactions.createdAt)],
    limit,
    offset,
  });
  return c.json(rows.map(r => ({ ...r, createdAt: (r.createdAt as Date).toISOString() })));
});

export default app;
