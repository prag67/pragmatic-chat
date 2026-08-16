/**
 * Search — simple ILIKE search over conversations/messages/files (pgvector-ready placeholder).
 * @module search
 * For slice4: LIKE search. Future: replace with pgvector cosine search on embeddings.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auth } from '../lib/auth.js';

const app = new OpenAPIHono();

async function getUserId(c: any): Promise<string | null> {
  try { const s = await auth.api.getSession({ headers: c.req.raw.headers as any }); return (s as any)?.user?.id ?? null; } catch { return null; }
}

const searchRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['search'],
  summary: 'Search user data (conversations/messages/files)',
  request: {
    query: z.object({
      q: z.string().min(1).max(200).openapi({ param: { name: 'q', in: 'query' }, example: 'hello' }),
      limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    }),
  },
  responses: {
    200: { description: 'Search results', content: { 'application/json': { schema: z.object({
      conversations: z.array(z.object({ id: z.string(), title: z.string().nullable(), snippet: z.string().nullable() })),
      messages: z.array(z.object({ id: z.string(), conversationId: z.string(), role: z.string(), snippet: z.string() })),
      files: z.array(z.object({ id: z.string(), originalName: z.string(), filename: z.string() })),
    }) } } },
    401: { description: 'Unauthorized' },
    400: { description: 'Missing query' },
  },
});

app.openapi(searchRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const { q, limit } = c.req.valid('query');
  const like = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  const convRows: any[] = await db.execute(sql`select id, title from conversations where user_id = ${userId}::uuid and (title ilike ${like}) order by updated_at desc limit ${limit}`) as any;
  const convArray = (convRows as any).rows ?? convRows;
  const msgRows: any[] = await db.execute(sql`select id, conversation_id, role, left(content, 200) as snippet from messages where user_id = ${userId}::uuid and content ilike ${like} order by created_at desc limit ${limit}`) as any;
  const msgArray = (msgRows as any).rows ?? msgRows;
  const fileRows: any[] = await db.execute(sql`select id, original_name, filename from files where user_id = ${userId}::uuid and (original_name ilike ${like} or filename ilike ${like}) order by created_at desc limit ${limit}`) as any;
  const fileArray = (fileRows as any).rows ?? fileRows;
  const norm = (rows: any[]) => Array.isArray(rows) ? rows.map(r => {
    const out: any = {};
    for (const k of Object.keys(r)) out[k.replace(/_([a-z])/g, (_: string, g: string) => g.toUpperCase())] = r[k];
    return out;
  }) : [];
  return c.json({
    conversations: (Array.isArray(convArray) ? convArray : norm(convArray as any)).map((r: any)=> ({ id: r.id, title: r.title, snippet: r.title })),
    messages: (Array.isArray(msgArray) ? msgArray : norm(msgArray as any)).map((r: any)=> ({ id: r.id, conversationId: r.conversationId ?? r.conversation_id, role: r.role, snippet: r.snippet ?? r.content })),
    files: (Array.isArray(fileArray) ? fileArray : norm(fileArray as any)).map((r: any)=> ({ id: r.id, originalName: r.originalName ?? r.original_name, filename: r.filename })),
  });
});

export default app;
