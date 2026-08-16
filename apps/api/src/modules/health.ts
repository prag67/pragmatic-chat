import { createRoute } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { z } from '@hono/zod-openapi';

const healthRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['health'],
  summary: 'Health check',
  responses: {
    200: {
      description: 'Service healthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string().openapi({ example: 'ok' }),
            db: z.string().openapi({ example: 'up' }),
            version: z.string().openapi({ example: '0.1.0' }),
            name: z.string().openapi({ example: 'pragmatic-api' }),
          }),
        },
      },
    },
  },
});

const readyRoute = createRoute({
  method: 'get',
  path: '/ready',
  tags: ['health'],
  responses: {
    200: { description: 'Ready', content: { 'application/json': { schema: z.object({ ready: z.boolean() }) } } },
  },
});

const app = new OpenAPIHono();

app.openapi(healthRoute, async (c) => {
  let dbOk = false;
  try { await db.execute(sql`select 1`); dbOk = true; } catch {}
  return c.json({ status: 'ok', db: dbOk ? 'up' : 'down', version: '0.1.0', name: 'pragmatic-api' });
});

app.openapi(readyRoute, async (c) => {
  try { await db.execute(sql`select 1`); return c.json({ ready: true }); }
  catch { return c.json({ ready: false } as any, 200); }
});

export default app;
