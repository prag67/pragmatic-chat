import { Hono } from 'hono';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

const r = new Hono();
r.get('/', async (c) => {
  let dbOk = false;
  try { await db.execute(sql`select 1`); dbOk = true; } catch {}
  return c.json({ status: 'ok', db: dbOk ? 'up' : 'down', version: '0.1.0', name: 'pragmatic-api' });
});
r.get('/ready', async (c) => {
  try { await db.execute(sql`select 1`); return c.json({ ready: true }); }
  catch (e) { return c.json({ ready: false, error: String(e) }, 503); }
});
export default r;
