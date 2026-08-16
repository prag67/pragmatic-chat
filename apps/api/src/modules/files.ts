import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { files } from '../db/schema.js';
import { auth } from '../lib/auth.js';
import { bodyLimit } from 'hono/body-limit';

const app = new OpenAPIHono();

async function getUserId(c: any): Promise<string | null> {
  try { const sess = await auth.api.getSession({ headers: c.req.raw.headers }); return (sess as any)?.user?.id ?? null; } catch { return null; }
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
  // Shared uploads with LibreChat: ../librechat/uploads and ./uploads
  const primaryDir = pathMod.resolve('./uploads');
  const legacyDir = pathMod.resolve('../librechat/uploads');
  await fs.mkdir(primaryDir, { recursive: true }).catch(() => {});
  const fullPath = pathMod.join(primaryDir, relPath);
  await fs.writeFile(fullPath, buf);
  // Also symlink/copy to legacy for rollback visibility if possible
  try { await fs.mkdir(legacyDir, { recursive: true }); await fs.copyFile(fullPath, pathMod.join(legacyDir, relPath)).catch(()=>{}); } catch {}

  const storagePath = `./uploads/${relPath}`;
  const [row] = await db.insert(files).values({
    userId, filename: relPath, originalName: file.name, mimeType: file.type || 'application/octet-stream', size: buf.length, storagePath,
  }).returning();
  return c.json(row, 201);
});

export default app;
