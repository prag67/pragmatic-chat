# Migration — LibreChat Mongo → Pragmatic Postgres + Cutover Runbook

## Pre-flight (shadow vs dormant)

- Legacy: `/opt/librechat` v0.8.7 `LibreChat` `chat-mongodb:27017` `chat-meilisearch` `:3080`, nginx `ai.pragmaticonline.com / → :3080` (stable for 2w rollback).
- Greenfield: `/opt/pragmatic` Hono `OpenAPIHono` + `pgvector:5433` (`vector 0.8.0`) + `redis:6380` + `qwen-proxy:8081` on `host.docker.internal`, `systemd pragmatic-api :4000` + `pragmatic-web :5173` (`base:'/v2/'`), nginx `/v2/→:5173` + `/v2/health|/v2/api/→:4000`.
- DB: 10 tables now (`user, session, account, verification, conversations, messages+embedding vector(1536) hnsw, files+embedding vector(1536) hnsw+embedding_model, balances, transactions, presets`) — `drizzle 0000_friendly_black_knight + 0001_tidy_moon` (`CREATE EXTENSION vector` + `hnsw vector_cosine_ops`).

## Migrate dry-run

```bash
# From inside librechat network (recommended) — uses chat-mongodb docker DNS
docker run --rm --network librechat_default \
  -e MONGO_URI=mongodb://chat-mongodb:27017/LibreChat \
  -e DATABASE_URL=postgres://pragmatic:pragmatic@host.docker.internal:5433/pragmatic \
  -v /opt/pragmatic:/app -w /app node:22 node scripts/migrate-mongo-to-postgres.mjs --dry-run
# Host fallback (requires MONGO_URI reachable; if ECONNREFUSED, expose mongo or run via docker exec above)
MONGO_URI=mongodb://127.0.0.1:27017/LibreChat DATABASE_URL=postgres://pragmatic:pragmatic@localhost:5433/pragmatic node scripts/migrate-mongo-to-postgres.mjs --dry-run
# Check real mongo via exec
docker exec chat-mongodb mongosh LibreChat --quiet --eval "db.users.countDocuments(); db.conversations.countDocuments(); db.messages.countDocuments()"
docker exec pragmatic-postgres psql -U pragmatic -d pragmatic -c "select count(*) from \"user\"; select count(*) from conversations; select count(*) from messages; select count(*) from files;"
```

## Migrate (idempotent, Better-Auth aware)

`scripts/migrate-mongo-to-postgres.mjs` (now Better-Auth aware):

- Reads `users` → upserts `"user"` (`name,email,email_verified,role`) + creates placeholder `"account"` (`provider_id=credential, password=not-migrated:uuid`) — **passwords must be reset** (`/api/auth/forget-password` or admin). Also `balances` 0 init.
- `conversations` → `conversations` (`user_id,title,model,endpoint,created_at`).
- `messages` → `messages` (`conversation_id,user_id,role,content,model,created_at`) sorted `createdAt ASC`; truncates `content` 32k.
- `files` → `files` (metadata only; blobs stay in `./uploads` shared volume `../librechat/uploads`).
- `presets` → `presets` (jsonb).

Idempotent: `on conflict (email) do update`, `on conflict do nothing` for files. Re-running after cutover is safe.

```bash
docker run --rm --network librechat_default \
  -e MONGO_URI=mongodb://chat-mongodb:27017/LibreChat \
  -e DATABASE_URL=postgres://pragmatic:pragmatic@host.docker.internal:5433/pragmatic \
  -v /opt/pragmatic:/app -w /app node:22 node scripts/migrate-mongo-to-postgres.mjs
# or limit/test
MIGRATE_LIMIT=100 node scripts/migrate-mongo-to-postgres.mjs
# Verify
docker exec pragmatic-postgres psql -U pragmatic -d pragmatic -c "select email,role from \"user\" limit 5; select count(*) from conversations; select count(*) from messages; select count(*) from files where embedding is not null;"
```

**Password reset note:** LibreChat bcrypt hashes cannot be imported into Better-Auth `account.password` (scrypt). Users must reset via email or `psql` admin set temporary password via Better-Auth flow — not raw `account.password`. Keep `pragmaticonline.com` allowlist (`databaseHooks.user.create.before`).

## Embeddings (pgvector)

- `files.embedding vector(1536)` + `files.embedding_model` + `messages.embedding vector(1536)` + `hnsw` indexes already `0001_tidy_moon`.
- `POST /api/files/upload` now generates embedding: tries `DASHSCOPE_API_KEY` `text-embedding-v2` (`https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding`), fallback `pseudoEmbedding(text)` deterministic unit vector 1536 (hash → sin). Stored directly, reused for search.
- `GET /api/search?q=&limit=` tries pgvector cosine (`embedding <=> vector`) on `messages`/`files` first (score `1-distance`), falls back to `ILIKE` if no embeddings or extension missing. `conversations.title` stays `ILIKE` (add conv embedding later).

Regenerate embeddings for old rows:

```bash
docker exec pragmatic-postgres psql -U pragmatic -d pragmatic -c "update files set embedding=null where embedding_model='pseudo-1536';"
# re-upload or run node script to re-embed (TODO: admin backfill endpoint)
```

## Nginx flip + 2-week rollback

Current nginx `ai.pragmaticonline.com`:

```
location /              { proxy_pass http://127.0.0.1:3080; }      # LibreChat
location /v2/           { proxy_pass http://127.0.0.1:5173; }      # Pragmatic web Vite preview
location = /v2/health   { proxy_pass http://127.0.0.1:4000/health; proxy_buffering off; proxy_read_timeout 600s; }
location /v2/api/       { proxy_pass http://127.0.0.1:4000/api/; proxy_buffering off; proxy_read_timeout 600s; }
```

**Cutover (flip `/` to Pragmatic, keep `/v2` compat):**

```nginx
# /etc/nginx/sites-available/ai.pragmaticonline.com — keep 3080 2w
location /              { proxy_pass http://127.0.0.1:5173; } # after: vite preview (or built nginx static)
location /api/          { proxy_pass http://127.0.0.1:4000/api/; proxy_buffering off; proxy_read_timeout 600s; }
location /health        { proxy_pass http://127.0.0.1:4000/health; }
# keep /v2/* compat redirects during transition
location /v2/           { return 301 $request_uri; } # or proxy_pass same as /  if need dual
```

Steps:

1. `npm --workspace apps/web run build` + serve via nginx static or keep `vite preview` systemd.
2. `sudo nginx -t && sudo systemctl reload nginx`
3. `curl https://ai.pragmaticonline.com/health` → `{"status":"ok","db":"up"}` + `curl https://ai.pragmaticonline.com/doc | jq .info.title`
4. Monitor `systemctl status pragmatic-api/web` + `docker logs pragmatic-postgres` 24h.
5. **Rollback (2w):** revert `location /` to `:3080`, `sudo nginx -t && sudo systemctl reload nginx`, Postgres stays populated — no data loss.
6. After 2w stable, `docker compose -f /opt/librechat/docker-compose.yml down` or keep dormant, prune `chat-mongodb` after final verify, retain `pragmatic_pgdata` volume backups (`pg_dump`).

**Backups before flip:**

```bash
docker exec pragmatic-postgres pg_dump -U pragmatic pragmatic | gzip > /opt/pragmatic/backups/pg-`date +%F`.sql.gz
docker exec chat-mongodb mongodump --db LibreChat --archive=/tmp/mongo.archive && docker cp chat-mongodb:/tmp/mongo.archive /opt/pragmatic/backups/
```

## Checklist

- [ ] `CREATE EXTENSION vector` verified `select * from pg_extension where extname='vector'`
- [ ] `migrate --dry-run` shows expected counts, no ECONNREFUSED
- [ ] Real migrate run, `psql` counts match`mongo` counts (± orphan skips)
- [ ] `curl /api/models` live qwen list, `curl /api/search?q=hello` returns vector+ILIKE results
- [ ] Admin `POST /api/admin/balances/adjust` works for seeded admin
- [ ] `vite build` + `systemd` active, `nginx -t` ok, `/health` + `/doc` reachable via `https://ai.pragmaticonline.com`
- [ ] 2w rollback window communicated, backups stored
