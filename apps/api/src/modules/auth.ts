import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { hashPassword, verifyPassword, signAccessToken, signRefreshToken, verifyToken } from '../lib/auth.js';
import { nanoid } from 'nanoid';

const r = new Hono();

r.post('/register', zValidator('json', z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() })), async (c) => {
  const { email, password, name } = c.req.valid('json');
  const exists = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (exists) return c.json({ error: 'Email already registered' }, 409);
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ email, passwordHash, name }).returning();
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id });
  await db.insert(sessions).values({ id: nanoid(), userId: user.id, refreshToken, expiresAt: new Date(Date.now()+7*864e5) });
  return c.json({ user: { id: user.id, email: user.email, name: user.name }, accessToken, refreshToken });
});

r.post('/login', zValidator('json', z.object({ email: z.string().email(), password: z.string().min(1) })), async (c) => {
  const { email, password } = c.req.valid('json');
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.passwordHash) return c.json({ error: 'Invalid credentials' }, 401);
  if (!await verifyPassword(password, user.passwordHash)) return c.json({ error: 'Invalid credentials' }, 401);
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id });
  await db.insert(sessions).values({ id: nanoid(), userId: user.id, refreshToken, expiresAt: new Date(Date.now()+7*864e5) });
  return c.json({ user: { id: user.id, email: user.email, name: user.name }, accessToken, refreshToken });
});

r.post('/refresh', zValidator('json', z.object({ refreshToken: z.string() })), async (c) => {
  const { refreshToken } = c.req.valid('json');
  try {
    const payload = verifyToken(refreshToken) as any;
    const accessToken = signAccessToken({ sub: payload.sub });
    return c.json({ accessToken });
  } catch { return c.json({ error: 'Invalid refresh token' }, 401); }
});

r.get('/me', async (c) => {
  const auth = c.req.header('authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const payload = verifyToken(auth.slice(7)) as any;
    const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user) return c.json({ error: 'Not found' }, 404);
    return c.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch { return c.json({ error: 'Unauthorized' }, 401); }
});

export default r;
