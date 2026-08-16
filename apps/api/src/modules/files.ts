import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { files } from '../db/schema.js';
import { auth } from '../lib/auth.js';
import { bodyLimit } from 'hono/body-limit';

const app = new OpenAPIHono();

async function getUserId(c: any): Promise<string | null> {
  try { const sess = await auth.api.getSession({ headers: c.req.raw.headers }); return (sess as any)?.user?.id ?? null; } catch { return null; }
}

/**
 * Deterministic pseudo-embedding for offline dev: hash text -> unit vector 1536.
 * Replace with real DashScope/Qwen embedding call when DASHSCOPE_API_KEY + model available.
 */
function pseudoEmbedding(text: string, dims = 1536): number[] {
  const vec = new Array(dims).fill(0);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  for (let i = 0; i < dims; i++) {
    const n = Math.sin(h + i * 0.987) * 10000;
    vec[i] = n - Math.floor(n);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v*v, 0)) || 1;
  return vec.map(v => v / norm);
}
async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.DASHSCOPE_API_KEY;
  const url = process.env.QWEN_EMBED_URL || 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
  if (key) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: 'text-embedding-v2', input: text.slice(0, 8000) }) });
      if (res.ok) { const j: any = await res.json(); const v = j.output?.embeddings?.[0]?.embedding || j.data?.[0]?.embedding; if (Array.isArray(v)) return v; }
    } catch {}
  }
  return pseudoEmbedding(text);
}

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['files'],
  responses: { 200: { description: 'List files' }, 401: { description: 'Unauthorized' } },
});

const uploadRoute = createRoute({
  method: 'post',
  path: '/upload',
  tags: ['files'],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
          }),
        },
      },
    },
  },
  responses: { 201: { description: 'Uploaded' }, 400: { description: 'No file' }, 401: { description: 'Unauthorized' }, 413: { description: 'Too large' } },
});

app.openapi(listRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await db.query.files.findMany({ where: eq(files.userId, userId), limit: 100 });
  return c.json(rows);
});

app.use('/upload', bodyLimit({ maxSize: 20 * 1024 * 1024, onError: (c) => c.text('File too large', 413) }));

app.openapi(uploadRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'No file' }, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const relPath = `${id}-${safeName}`;
  const fs = await import('node:fs/promises');
  const pathMod = await import('node:path');
  const primaryDir = pathMod.resolve('./uploads');
  const legacyDir = pathMod.resolve('../librechat/uploads');
  await fs.mkdir(primaryDir, { recursive: true }).catch(() => {});
  const fullPath = pathMod.join(primaryDir, relPath);
  await fs.writeFile(fullPath, buf);
  try { await fs.mkdir(legacyDir, { recursive: true }); await fs.copyFile(fullPath, pathMod.join(legacyDir, relPath)).catch(()=>{}); } catch {}

  const storagePath = `./uploads/${relPath}`;
  let embedding: number[] | null = null;
  let embeddingModel: string | null = null;
  try {
    const textSample = buf.toString('utf-8').slice(0, 8000);
    if (textSample.trim().length > 2) {
      embedding = await embedText(textSample);
      embeddingModel = process.env.DASHSCOPE_API_KEY ? 'text-embedding-v2' : 'pseudo-1536';
    }
  } catch {}

  const [row] = await db.insert(files).values({
    userId, filename: relPath, originalName: file.name, mimeType: file.type || 'application/octet-stream', size: buf.length, storagePath,
    embedding: embedding as any, embeddingModel,
  }).returning();
  return c.json(row, 201);
});

export default app;
