#!/usr/bin/env node
// Migrate LibreChat Mongo -> Pragmatic Postgres
// Usage: node scripts/migrate-mongo-to-postgres.mjs [--dry-run]
// Reads from MONGO_URI (default mongodb://127.0.0.1:27017/LibreChat) and writes to DATABASE_URL
import { MongoClient } from 'mongodb';
import pg from 'pg';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://pragmatic:pragmatic@localhost:5433/pragmatic';
const DRY = process.argv.includes('--dry-run');

console.log(`[migrate] Mongo: ${MONGO_URI}`);
console.log(`[migrate] Postgres: ${DATABASE_URL} ${DRY ? '(dry-run)' : ''}`);

const mongo = new MongoClient(MONGO_URI);
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function ensureTables() {
  // Minimal DDL if drizzle migrate not yet run (idempotent)
  await pool.query(`
    create extension if not exists "pgcrypto";
    create table if not exists users (id uuid primary key default gen_random_uuid(), email varchar(320) not null unique, email_verified boolean not null default false, name varchar(120), password_hash text, avatar_url text, role varchar(20) not null default 'user', provider varchar(20) not null default 'local', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table if not exists conversations (id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, title varchar(500), model varchar(120), endpoint varchar(60) default 'qwen', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table if not exists messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references conversations(id) on delete cascade, user_id uuid not null references users(id) on delete cascade, role varchar(20) not null, content text not null, model varchar(120), token_count integer, is_error boolean not null default false, parent_id uuid, created_at timestamptz not null default now());
  `);
}

async function main() {
  await mongo.connect();
  await ensureTables();
  const db = mongo.db();
  const mUsers = db.collection('users');
  const mConvos = db.collection('conversations');
  const mMessages = db.collection('messages');

  const userCount = await mUsers.countDocuments();
  const convoCount = await mConvos.countDocuments();
  const msgCount = await mMessages.countDocuments();
  console.log(`[migrate] Mongo counts: users=${userCount} convos=${convoCount} messages=${msgCount}`);

  if (DRY) { console.log('[migrate] dry-run done'); process.exit(0); }

  // Map Mongo _id/email -> Postgres uuid
  const userIdMap = new Map();
  for await (const u of mUsers.find()) {
    const email = u.email;
    if (!email) continue;
    const res = await pool.query(
      `insert into users (email, name, password_hash, role, provider, created_at) values ($1,$2,$3,$4,$5,$6)
       on conflict (email) do update set name=excluded.name returning id, email`,
      [email, u.name || u.username || null, u.password || null, u.role || 'user', 'local', u.createdAt || new Date()]
    );
    userIdMap.set(String(u._id), res.rows[0].id);
    userIdMap.set(email, res.rows[0].id);
  }
  console.log(`[migrate] users migrated: ${userIdMap.size/2}`);

  let convosMigrated = 0;
  const convoIdMap = new Map();
  for await (const c of mConvos.find()) {
    const mongoUserId = String(c.user || c.userId);
    const pgUserId = userIdMap.get(mongoUserId) || userIdMap.get(c.user);
    if (!pgUserId) continue;
    const res = await pool.query(
      `insert into conversations (user_id, title, model, endpoint, created_at, updated_at) values ($1,$2,$3,$4,$5,$6) returning id`,
      [pgUserId, c.title || 'Untitled', c.model || null, c.endpoint || 'qwen', c.createdAt || new Date(), c.updatedAt || new Date()]
    );
    convoIdMap.set(String(c._id), res.rows[0].id);
    convoIdMap.set(String(c.conversationId), res.rows[0].id);
    convosMigrated++;
  }
  console.log(`[migrate] conversations migrated: ${convosMigrated}`);

  let msgsMigrated = 0;
  for await (const m of mMessages.find().sort({ createdAt: 1 })) {
    const pgUserId = userIdMap.get(String(m.user)) || [...userIdMap.values()][0];
    const pgConvoId = convoIdMap.get(String(m.conversationId)) || convoIdMap.get(String(m.conversationId));
    if (!pgUserId || !pgConvoId) continue;
    const role = m.isCreatedByUser ? 'user' : (m.sender === 'user' ? 'user' : 'assistant');
    await pool.query(
      `insert into messages (conversation_id, user_id, role, content, model, created_at) values ($1,$2,$3,$4,$5,$6)`,
      [pgConvoId, pgUserId, role, m.text || m.content || '', m.model || null, m.createdAt || new Date()]
    );
    msgsMigrated++;
  }
  console.log(`[migrate] messages migrated: ${msgsMigrated}`);
  console.log('[migrate] done — verify: psql $DATABASE_URL -c "select count(*) from users; select count(*) from conversations; select count(*) from messages;"');
  await mongo.close(); await pool.end();
}
main().catch(e=>{console.error(e); process.exit(1);});
