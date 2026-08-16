#!/usr/bin/env node
// Migrate LibreChat Mongo -> Pragmatic Postgres (Better-Auth schema)
// Usage: node scripts/migrate-mongo-to-postgres.mjs [--dry-run] [--limit 1000]
// Env: MONGO_URI default mongodb://chat-mongodb:27017/LibreChat (docker) or 127.0.0.1:27017/LibreChat
//      DATABASE_URL default postgres://pragmatic:pragmatic@localhost:5433/pragmatic
import { MongoClient } from 'mongodb';
import pg from 'pg';
import crypto from 'node:crypto';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://pragmatic:pragmatic@localhost:5433/pragmatic';
const DRY = process.argv.includes('--dry-run');
const LIMIT = Number(process.env.MIGRATE_LIMIT || 0) || 0;

console.log(`[migrate] Mongo: ${MONGO_URI}`);
console.log(`[migrate] Postgres: ${DATABASE_URL} ${DRY ? '(dry-run)' : ''}`);

const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 });
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function ensureExtensions(){
  await pool.query(`create extension if not exists "pgcrypto"; create extension if not exists vector;`);
}
function toEmail(u){ return (u.email || '').toLowerCase().trim(); }

async function main(){
  try { await mongo.connect(); } catch(e){
    console.error(`[migrate] Mongo connect failed: ${e.message}`);
    console.error(`[migrate] Tip: from host try MONGO_URI=mongodb://chat-mongodb:27017/LibreChat docker exec, or expose mongo port, or run via: docker run --rm --network librechat_default -e MONGO_URI=mongodb://chat-mongodb:27017/LibreChat -v /opt/pragmatic:/app node:22 node /app/scripts/migrate-mongo-to-postgres.mjs --dry-run`);
    await pool.end().catch(()=>{});
    process.exit(0);
  }
  await ensureExtensions();
  const mdb = mongo.db();
  const mUsers = mdb.collection('users');
  const mConvos = mdb.collection('conversations');
  const mMessages = mdb.collection('messages');
  const mFiles = mdb.collection('files');
  const mPresets = mdb.collection('presets');

  const userCount = await mUsers.countDocuments();
  const convoCount = await mConvos.countDocuments();
  const msgCount = await mMessages.countDocuments();
  let fileCount=0; try{ fileCount=await mFiles.countDocuments(); }catch{}
  console.log(`[migrate] Mongo counts: users=${userCount} convos=${convoCount} messages=${msgCount} files=${fileCount}`);
  if(DRY){ console.log('[migrate] dry-run done'); await mongo.close(); await pool.end(); process.exit(0); }

  const userIdMap = new Map();
  const emailToPgId = new Map();
  let usersMigrated=0;
  for await (const u of mUsers.find().limit(LIMIT||0)){
    const email = toEmail(u);
    if(!email || emailToPgId.has(email)) continue;
    const name = u.name || u.username || email.split('@')[0];
    const existing = await pool.query(`select id from "user" where email=$1`, [email]);
    let pgId;
    if(existing.rows.length){
      pgId = existing.rows[0].id;
      await pool.query(`update "user" set name=$2, role=$3 where id=$1`, [pgId, name, u.role || 'user']);
    } else {
      const r = await pool.query(`insert into "user" (name, email, email_verified, role) values ($1,$2,$3,$4) returning id`, [name, email, !!u.emailVerified, u.role || 'user']);
      pgId = r.rows[0].id;
      const fakeHash = 'not-migrated:'+crypto.randomUUID();
      await pool.query(`insert into "account" (account_id, provider_id, user_id, password) values ($1,$2,$3,$4) on conflict do nothing`, [email, 'credential', pgId, fakeHash]);
      await pool.query(`insert into balances (user_id, token_credits) values ($1,0) on conflict (user_id) do nothing`, [pgId]);
    }
    userIdMap.set(String(u._id), pgId);
    emailToPgId.set(email, pgId);
    usersMigrated++;
  }
  console.log(`[migrate] users migrated: ${usersMigrated} (passwords require reset)`);

  const fallbackPgId = emailToPgId.values().next().value || (await pool.query(`select id from "user" limit 1`).then(r=>r.rows[0]?.id));
  let convosMigrated=0;
  const convoIdMap = new Map();
  for await (const c of mConvos.find().limit(LIMIT||0)){
    const pgUserId = userIdMap.get(String(c.user||c.userId)) || fallbackPgId;
    if(!pgUserId) continue;
    const title = c.title || c.name || 'Untitled';
    const r = await pool.query(`insert into conversations (user_id, title, model, endpoint, created_at, updated_at) values ($1,$2,$3,$4,$5,$6) returning id`, [pgUserId, title, c.model||null, c.endpoint||'qwen', c.createdAt||new Date(), c.updatedAt||new Date()]);
    const pgId = r.rows[0].id;
    convoIdMap.set(String(c._id), pgId);
    if(c.conversationId) convoIdMap.set(String(c.conversationId), pgId);
    convosMigrated++;
  }
  console.log(`[migrate] conversations migrated: ${convosMigrated}`);

  let msgsMigrated=0;
  const cursor = mMessages.find().sort({ createdAt: 1 });
  if(LIMIT) cursor.limit(LIMIT);
  for await (const m of cursor){
    const pgConvoId = convoIdMap.get(String(m.conversationId||m.conversation_id));
    const pgUserId = userIdMap.get(String(m.user||m.userId)) || fallbackPgId;
    if(!pgConvoId || !pgUserId) continue;
    const role = m.role || (m.isCreatedByUser ? 'user' : (m.sender==='user'?'user':'assistant')) || 'user';
    const content = m.text || m.content || m.message || '';
    if(!content) continue;
    await pool.query(`insert into messages (conversation_id, user_id, role, content, model, created_at) values ($1,$2,$3,$4,$5,$6)`, [pgConvoId, pgUserId, role, String(content).slice(0, 32000), m.model||null, m.createdAt||new Date()]);
    msgsMigrated++;
  }
  console.log(`[migrate] messages migrated: ${msgsMigrated}`);

  let filesMigrated=0;
  try{
    for await (const f of mFiles.find().limit(LIMIT||0)){
      const pgUserId = userIdMap.get(String(f.user)) || fallbackPgId;
      if(!pgUserId) continue;
      const pgConvoId = f.conversationId ? convoIdMap.get(String(f.conversationId)) : null;
      await pool.query(`insert into files (user_id, conversation_id, filename, original_name, mime_type, size, storage_path) values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing`, [pgUserId, pgConvoId, f.filename||f.name||'file', f.originalName||f.filename||'file', f.mimeType||'application/octet-stream', f.size||0, f.storagePath||`./uploads/${f.filename||'file'}`]);
      filesMigrated++;
    }
    console.log(`[migrate] files migrated: ${filesMigrated}`);
  }catch(e){ console.log('[migrate] files skip', e.message); }

  let presetsMigrated=0;
  try{
    for await (const p of mPresets.find().limit(LIMIT||0)){
      const pgUserId = userIdMap.get(String(p.user)) || fallbackPgId;
      if(!pgUserId) continue;
      await pool.query(`insert into presets (user_id, title, data) values ($1,$2,$3)`, [pgUserId, p.title||'preset', JSON.stringify(p.data||p)]);
      presetsMigrated++;
    }
    console.log(`[migrate] presets migrated: ${presetsMigrated}`);
  }catch(e){ console.log('[migrate] presets skip', e.message); }

  console.log('[migrate] done — verify: psql $DATABASE_URL -c "select count(*) from \"user\"; select count(*) from conversations; select count(*) from messages; select count(*) from files;"');
  await mongo.close(); await pool.end();
}
main().catch(e=>{console.error(e); process.exit(1);});
