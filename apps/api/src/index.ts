import 'dotenv/config';
import { serve } from '@hono/node-server';
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env.js';

import auth from './modules/auth.js';
import conversations from './modules/conversations.js';
import messages from './modules/messages.js';
import files from './modules/files.js';
import balances from './modules/balances.js';
import presets from './modules/presets.js';
import health from './modules/health.js';

const app = new OpenAPIHono();

app.use('*', logger());
app.use('*', cors({
  origin: [env.APP_URL, 'http://localhost:5173', 'http://localhost:3080', 'http://localhost:3081', 'https://ai.pragmaticonline.com'],
  credentials: true,
}));

app.route('/health', health);
app.route('/api/auth', auth);
app.route('/api/conversations', conversations);
app.route('/api/messages', messages);
app.route('/api/files', files);
app.route('/api/balances', balances);
app.route('/api/presets', presets);

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '0.1.0',
    title: 'Pragmatic API',
    description: 'Pragmatic Chat v2 - Hono + Postgres + Better Auth',
  },
});

app.get('/openapi.json', (c) => {
  const doc = app.getOpenAPI31Document({
    openapi: '3.0.0',
    info: { title: 'Pragmatic API', version: '0.1.0' },
  });
  return c.json(doc);
});

app.get('/ui', swaggerUI({ url: '/doc' }));
app.get('/scalar', Scalar({ url: '/doc', theme: 'kepler' }));
app.get('/docs', Scalar({ url: '/doc' }));

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal error', details: err.message }, 500);
});

const port = env.PORT;
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  console.log(`[pragmatic-api] DATABASE_URL=${env.DATABASE_URL}`);
  console.log(`[pragmatic-api] BETTER_AUTH_URL=${env.BETTER_AUTH_URL}`);
  console.log(`[pragmatic-api] starting on :${port}`);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[pragmatic-api] listening on http://localhost:${info.port}`);
  });
}

export default app;
