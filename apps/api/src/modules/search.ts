/**
 * Search — ILIKE + pgvector cosine fallback on files/messages embeddings.
 * @module search
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
function pseudoEmbedding(text: string, dims = 1536): number[] {
  const vec = new Array(dims).fill(0);
  let h = 2166136261;
  for (let i=0;i<text.length;i++){ h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  for(let i=0;i<dims;i++){ const n=Math.sin(h+i*0.987)*10000; vec[i]= n - Math.floor(n); }
  const norm=Math.sqrt(vec.reduce((s,v)=>s+v*v,0))||1;
  return vec.map(v=>v/norm);
}
function toVectorLiteral(v: number[]): string { return `[${v.join(',')}]`; }

const searchRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['search'],
  summary: 'Search user data (ILIKE + pgvector cosine on files/messages)',
  request: {
    query: z.object({
      q: z.string().min(1).max(200).openapi({ param: { name: 'q', in: 'query' }, example: 'hello' }),
      limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    }),
  },
  responses: {
    200: { description: 'Search results', content: { 'application/json': { schema: z.object({
      conversations: z.array(z.object({ id: z.string(), title: z.string().nullable(), snippet: z.string().nullable() })),
      messages: z.array(z.object({ id: z.string(), conversationId: z.string(), role: z.string(), snippet: z.string(), score: z.number().nullable().optional() })),
      files: z.array(z.object({ id: z.string(), originalName: z.string(), filename: z.string(), score: z.number().nullable().optional() })),
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

  const convRaw: any = await db.execute(sql`select id, title from conversations where user_id = ${userId}::uuid and (title ilike ${like}) order by updated_at desc limit ${limit}`);
  const convRows = (convRaw as any).rows ?? convRaw;

  let msgRows: any[] = [];
  let fileRows: any[] = [];
  let usedVector = false;
  // Try pgvector cosine search if embeddings exist (pseudo or real). Fallback to ILIKE.
  try {
    const qvec = pseudoEmbedding(q);
    const vecLit = toVectorLiteral(qvec);
    const msgVecRaw: any = await db.execute(sql`select id, conversation_id, role, left(content, 200) as snippet, (embedding <=> ${vecLit}::vector) as distance from messages where user_id = ${userId}::uuid and embedding is not null order by embedding <=> ${vecLit}::vector asc limit ${limit}`);
    const msgVec = (msgVecRaw as any).rows ?? msgVecRaw;
    if (Array.isArray(msgVec) && msgVec.length > 0) { msgRows = msgVec.map((r:any)=> ({ ...r, score: r.distance != null ? 1 - Number(r.distance) : null })); usedVector = true; }
    const fileVecRaw: any = await db.execute(sql`select id, original_name, filename, (embedding <=> ${vecLit}::vector) as distance from files where user_id = ${userId}::uuid and embedding is not null order by embedding <=> ${vecLit}::vector asc limit ${limit}`);
    const fileVec = (fileVecRaw as any).rows ?? fileVecRaw;
    if (Array.isArray(fileVec) && fileVec.length > 0) { fileRows = fileVec.map((r:any)=> ({ ...r, score: r.distance != null ? 1 - Number(r.distance) : null })); usedVector = true; }
  } catch (e) { /* pgvector not ready or no embeddings */ }

  if (!usedVector || msgRows.length === 0) {
    const msgRaw: any = await db.execute(sql`select id, conversation_id, role, left(content, 200) as snippet from messages where user_id = ${userId}::uuid and content ilike ${like} order by created_at desc limit ${limit}`);
    msgRows = (msgRaw as any).rows ?? msgRaw;
  }
  if (!usedVector || fileRows.length === 0) {
    if (fileRows.length === 0) {
      const fileRaw: any = await db.execute(sql`select id, original_name, filename from files where user_id = ${userId}::uuid and (original_name ilike ${like} or filename ilike ${like}) order by created_at desc limit ${limit}`);
      fileRows = (fileRaw as any).rows ?? fileRaw;
    }
  }

  const norm = (rows: any[]) => Array.isArray(rows) ? rows.map(r => {
    const out: any = {};
    for (const k of Object.keys(r)) out[k.replace(/_([a-z])/g, (_: string, g: string) => g.toUpperCase())] = r[k];
    return out;
  }) : [];
  const convArr = Array.isArray(convRows) ? convRows : norm(convRows as any);
  const msgArr = Array.isArray(msgRows) ? msgRows : norm(msgRows as any);
  const fileArr = Array.isArray(fileRows) ? fileRows : norm(fileRows as any);

  return c.json({
    conversations: convArr.map((r: any)=> ({ id: r.id, title: r.title, snippet: r.title })),
    messages: msgArr.map((r: any)=> ({ id: r.id, conversationId: r.conversationId ?? r.conversation_id, role: r.role, snippet: r.snippet ?? r.content, score: r.score ?? r.distance != null ? (1 - Number(r.distance)) : null })),
    files: fileArr.map((r: any)=> ({ id: r.id, originalName: r.originalName ?? r.original_name, filename: r.filename, score: r.score ?? r.distance != null ? (1 - Number(r.distance)) : null })),
  });
});

export default app;
