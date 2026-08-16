/**
 * Models registry — proxies Qwen compatible endpoint or returns static fallback.
 * @module models
 */
import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { env } from '../lib/env.js';

const app = new OpenAPIHono();

const modelSchema = z.object({
  id: z.string().openapi({ example: 'qwen-plus' }),
  object: z.string().openapi({ example: 'model' }),
  created: z.number().optional(),
  owned_by: z.string().optional(),
}).openapi('Model');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['models'],
  summary: 'List available models (proxies qwen-proxy if reachable)',
  responses: {
    200: { description: 'Models', content: { 'application/json': { schema: z.object({ object: z.string(), data: z.array(modelSchema) }) } } },
  },
});

const fallback = [
  { id: 'qwen-plus', object: 'model', owned_by: 'qwen' },
  { id: 'qwen-max', object: 'model', owned_by: 'qwen' },
  { id: 'qwen-turbo', object: 'model', owned_by: 'qwen' },
];

app.openapi(listRoute, async (c) => {
  const upstream = env.QWEN_PROXY_URL || 'http://localhost:8081';
  const dashKey = process.env.DASHSCOPE_API_KEY || '';
  try {
    const res = await fetch(`${upstream}/compatible-mode/v1/models`, {
      headers: { Authorization: `Bearer ${dashKey}` },
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (data?.data && Array.isArray(data.data)) return c.json(data);
    }
  } catch {}
  return c.json({ object: 'list', data: fallback });
});

export default app;
