import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { db } from '../src/db/index.js';
import { sql } from 'drizzle-orm';

function getApp() {
  const handler = async (req: any, res: any) => {
    const url = `http://localhost${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach(val => headers.append(k, val));
      else if (v) headers.set(k, v as string);
    }
    let body: any;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise<string>((resolve) => {
        let data = '';
        req.on('data', (chunk: any) => data += chunk);
        req.on('end', () => resolve(data));
      });
    }
    const fetchReq = new Request(url, { method: req.method, headers, body: body || undefined });
    const fetchRes = await app.fetch(fetchReq);
    res.statusCode = fetchRes.status;
    fetchRes.headers.forEach((val, key) => res.setHeader(key, val));
    const text = await fetchRes.text();
    res.end(text);
  };
  return handler;
}

describe('Better Auth', () => {
  beforeAll(async () => {
    try { await db.execute(sql`delete from "user" where email like '%@example.com' or email like '%@test.com'`); } catch {}
  });

  afterAll(async () => {
    try { await db.execute(sql`delete from "user" where email like '%@example.com'`); } catch {}
  });

  it('health check', async () => {
    const handler = getApp();
    const res = await request(handler).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('OpenAPI doc exists', async () => {
    const handler = getApp();
    const res = await request(handler).get('/doc');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
  });

  it('sign-up with allowed domain (example.com in test)', async () => {
    const handler = getApp();
    const email = `vitest-${Date.now()}@example.com`;
    const res = await request(handler).post('/api/auth/sign-up/email').send({ email, password: 'Password123!', name: 'Vitest User' });
    expect([200,201].includes(res.status)).toBe(true);
  });

  it('rejects duplicate email', async () => {
    const handler = getApp();
    const email = `dup-${Date.now()}@example.com`;
    await request(handler).post('/api/auth/sign-up/email').send({ email, password: 'Password123!', name: 'Dup' });
    const res2 = await request(handler).post('/api/auth/sign-up/email').send({ email, password: 'Password123!', name: 'Dup2' });
    expect(res2.status).toBeGreaterThanOrEqual(400);
    expect(res2.body.code || res2.body.message || res2.body.error).toBeDefined();
  });

  it('rejects disallowed domain', async () => {
    const handler = getApp();
    const email = `bad-${Date.now()}@evil.com`;
    const res = await request(handler).post('/api/auth/sign-up/email').send({ email, password: 'Password123!', name: 'Bad' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('sign-in and get-session flow', async () => {
    const handler = getApp();
    const email = `flow-${Date.now()}@example.com`;
    await request(handler).post('/api/auth/sign-up/email').send({ email, password: 'Password123!', name: 'Flow' });
    const signIn = await request(handler).post('/api/auth/sign-in/email').send({ email, password: 'Password123!' });
    expect(signIn.status).toBe(200);
    const setCookie = signIn.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    const sess = await request(handler).get('/api/auth/get-session').set('Cookie', cookie);
    expect(sess.status).toBe(200);
    expect(sess.body.user?.email).toBe(email);
  });

  it('protected conversations require auth', async () => {
    const handler = getApp();
    const res = await request(handler).get('/api/conversations');
    expect(res.status).toBe(401);
  });

  it('create conversation with auth', async () => {
    const handler = getApp();
    const email = `conv-${Date.now()}@example.com`;
    await request(handler).post('/api/auth/sign-up/email').send({ email, password: 'Password123!', name: 'Conv' });
    const signIn = await request(handler).post('/api/auth/sign-in/email').send({ email, password: 'Password123!' });
    const cookie = (signIn.headers['set-cookie'] as string[]).join('; ');
    const created = await request(handler).post('/api/conversations').set('Cookie', cookie).send({ title: 'Test convo slice1' });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeDefined();
    const list = await request(handler).get('/api/conversations').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
  });

  it('file list requires auth', async () => {
    const handler = getApp();
    const res = await request(handler).get('/api/files');
    expect(res.status).toBe(401);
  });

  it('messages chat/completions requires auth', async () => {
    const handler = getApp();
    const res = await request(handler).post('/api/messages/chat/completions').send({ model: 'qwen-plus', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(401);
  });

  it('swagger ui and scalar available', async () => {
    const handler = getApp();
    const ui = await request(handler).get('/ui');
    expect(ui.status).toBe(200);
    const scalar = await request(handler).get('/scalar');
    expect(scalar.status).toBe(200);
  });

  it('balances me requires auth', async () => {
    const handler = getApp();
    const res = await request(handler).get('/api/balances/me');
    expect(res.status).toBe(401);
    const tx = await request(handler).get('/api/balances/transactions');
    expect(tx.status).toBe(401);
  });

  it('balances me returns 0 on first auth and transactions empty', async () => {
    const handler = getApp();
    const email = `bal-${Date.now()}@example.com`;
    await request(handler).post('/api/auth/sign-up/email').send({ email, password: 'Password123!', name: 'Bal' });
    const signIn = await request(handler).post('/api/auth/sign-in/email').send({ email, password: 'Password123!' });
    const cookie = (signIn.headers['set-cookie'] as string[]).join('; ');
    const me = await request(handler).get('/api/balances/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.tokenCredits).toBe(0);
    expect(me.body.userId).toBeDefined();
    const me2 = await request(handler).get('/api/balances').set('Cookie', cookie);
    expect(me2.status).toBe(200);
    expect(me2.body.tokenCredits).toBe(0);
    const tx = await request(handler).get('/api/balances/transactions').set('Cookie', cookie);
    expect(tx.status).toBe(200);
    expect(Array.isArray(tx.body)).toBe(true);
  });

  it('presets CRUD lifecycle', async () => {
    const handler = getApp();
    const email = `preset-${Date.now()}@example.com`;
    await request(handler).post('/api/auth/sign-up/email').send({ email, password: 'Password123!', name: 'Preset' });
    const signIn = await request(handler).post('/api/auth/sign-in/email').send({ email, password: 'Password123!' });
    const cookie = (signIn.headers['set-cookie'] as string[]).join('; ');

    const unauthed = await request(handler).get('/api/presets');
    expect(unauthed.status).toBe(401);

    const list0 = await request(handler).get('/api/presets').set('Cookie', cookie);
    expect(list0.status).toBe(200);
    expect(Array.isArray(list0.body)).toBe(true);

    const created = await request(handler).post('/api/presets').set('Cookie', cookie).send({ title: 'My preset', data: { model: 'qwen-plus', temperature: 0.7 } });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeDefined();
    expect(created.body.title).toBe('My preset');
    const pid = created.body.id;

    const list1 = await request(handler).get('/api/presets').set('Cookie', cookie);
    expect(list1.body.length).toBe(1);

    const got = await request(handler).get(`/api/presets/${pid}`).set('Cookie', cookie);
    expect(got.status).toBe(200);
    expect(got.body.title).toBe('My preset');

    const patched = await request(handler).patch(`/api/presets/${pid}`).set('Cookie', cookie).send({ title: 'Renamed', data: { model: 'qwen-max', temperature: 0.5 } });
    expect(patched.status).toBe(200);
    expect(patched.body.title).toBe('Renamed');
    expect(patched.body.data.model).toBe('qwen-max');

    const del = await request(handler).delete(`/api/presets/${pid}`).set('Cookie', cookie);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const after = await request(handler).get(`/api/presets/${pid}`).set('Cookie', cookie);
    expect(after.status).toBe(404);
  });

  it('presets isolation between users', async () => {
    const handler = getApp();
    const emailA = `isoA-${Date.now()}@example.com`;
    const emailB = `isoB-${Date.now()}@example.com`;
    await request(handler).post('/api/auth/sign-up/email').send({ email: emailA, password: 'Password123!', name: 'A' });
    await request(handler).post('/api/auth/sign-up/email').send({ email: emailB, password: 'Password123!', name: 'B' });
    const sA = await request(handler).post('/api/auth/sign-in/email').send({ email: emailA, password: 'Password123!' });
    const sB = await request(handler).post('/api/auth/sign-in/email').send({ email: emailB, password: 'Password123!' });
    const cA = (sA.headers['set-cookie'] as string[]).join('; ');
    const cB = (sB.headers['set-cookie'] as string[]).join('; ');
    const cr = await request(handler).post('/api/presets').set('Cookie', cA).send({ title: 'A only', data: { x: 1 } });
    const pid = cr.body.id;
    const bGet = await request(handler).get(`/api/presets/${pid}`).set('Cookie', cB);
    expect(bGet.status).toBe(404);
    await request(handler).delete(`/api/presets/${pid}`).set('Cookie', cA);
  });
});
