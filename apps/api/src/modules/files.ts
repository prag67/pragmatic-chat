import { Hono } from 'hono';
import { db } from '../db/index.js';
import { files } from '../db/schema.js';
import { verifyToken } from '../lib/auth.js';
import { eq } from 'drizzle-orm';

const r = new Hono();
function getUserId(c: any): string | null {
  const h = c.req.header('authorization');
  if (!h?.startsWith('Bearer ')) return null;
  try { const p: any = verifyToken(h.slice(7)); return p.sub; } catch { return null; }
}

r.get('/', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await db.query.files.findMany({ where: eq(files.userId, userId), limit: 100 });
  return c.json(rows);
});

// multipart upload -> saves to ./uploads (mounted volume, shared with librechat for cutover)
r.post('/upload', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const form = await c.req.formData();
  const file = form.get('file') as File | null;
  if (!file) return c.json({ error: 'No file' }, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID();
  const path = `./uploads/${id}-${file.name}`;
  const fs = await import('node:fs/promises'); await fs.mkdir('./uploads', {recursive:true}).catch(()=>{}); await fs.writeFile(path, buf);
  const [row] = await db.insert(files).values({
    userId, filename: `${id}-${file.name}`, originalName: file.name, mimeType: file.type || 'application/octet-stream', size: buf.length, storagePath: path
  }).returning();
  return c.json(row, 201);
});

export default r;
