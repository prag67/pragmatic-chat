import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env.js';

import auth from './modules/auth.js';
import conversations from './modules/conversations.js';
import messages from './modules/messages.js';
import files from './modules/files.js';
import health from './modules/health.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: [env.APP_URL, 'http://localhost:5173', 'http://localhost:3081', 'https://ai.pragmaticonline.com'],
  credentials: true,
}));

app.route('/health', health);
app.route('/api/auth', auth);
app.route('/api/conversations', conversations);
app.route('/api/messages', messages);
app.route('/api/files', files);

// OpenAPI style 404
app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal error', details: err.message }, 500);
});

const port = env.PORT;
console.log(`[pragmatic-api] DATABASE_URL=${env.DATABASE_URL}`);
console.log(`[pragmatic-api] starting on :${port}`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[pragmatic-api] listening on http://localhost:${info.port}`);
});

export default app;
