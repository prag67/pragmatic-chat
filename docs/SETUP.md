# SETUP

## Prerequisites
- Node 22+, `npm@10.8`, Docker, `psql` via `docker exec pragmatic-postgres`, nginx + Certbot (ai.pragmaticonline.com).
- Postgres 16 pgvector :5433 `pragmatic/pragmatic` healthy, Redis :6380, qwen-proxy :8081 (host.docker.internal).

## Env
`cp .env.example .env` then:
```
DATABASE_URL=postgres://pragmatic:pragmatic@localhost:5433/pragmatic
REDIS_URL=redis://localhost:6380
BETTER_AUTH_SECRET=cd1936e7c0446392a2ea214612fcfe9cfc629c7189838356afcc961a94111532 # ≥32 chars
BETTER_AUTH_URL=https://ai.pragmaticonline.com
JWT_SECRET=... # fallback
QWEN_PROXY_URL=http://localhost:8081
APP_URL=https://ai.pragmaticonline.com
PORT=4000
DASHSCOPE_API_KEY=sk-...
```
`BETTER_AUTH_SECRET` fallback to `JWT_SECRET` for dev. `BETTER_AUTH_URL` must match `trustedOrigins`.

## Quick start

```bash
git clone https://x-access-token:$GH_PAT@github.com/prag67/pragmatic-chat.git /opt/pragmatic
cd /opt/pragmatic
npm install
docker compose up pragmatic-postgres pragmatic-redis -d
npm --workspace apps/api run db:migrate  # requires DATABASE_URL
npm run dev        # concurrently api :4000 + web :5173
# or systemd:
sudo systemctl restart pragmatic-api pragmatic-web
curl http://localhost:4000/health        # {status:"ok",db:"up"}
curl http://localhost:4000/doc | jq .info.title
curl https://ai.pragmaticonline.com/v2/health
```

## Drizzle / Better Auth schema

```bash
# after editing src/db/schema.ts (better-auth tables: user,session,account,verification)
npm --workspace apps/api run db:generate
npm --workspace apps/api run db:migrate
# better-auth generate (optional, for reference)
npx @better-auth/cli generate --output src/db/auth-schema.ts
```

`better-auth` expects `drizzleAdapter(db, {provider:"pg", schema:{user,session,account,verification}})`, `generateId:"uuid"`.

## Tests

```bash
npm --workspace apps/api run test:ci   # vitest+supertest (21 tests: auth+balances/presets)
npm test                              # root workspaces (api + web)
npm --workspace apps/web run test     # RTL 5 tests incl. BalanceWidget/Presets
npx playwright test                   # e2e (TODO)
```

No server listen when `NODE_ENV=test` / `VITEST`.

## Nginx

- `/` → :3080 LibreChat (legacy)
- `/v2/` → :5173 Vite preview `base:'/v2/'` (`preview.allowedHosts:true`)
- `/v2/health` & `/v2/api/` → :4000 (`proxy_buffering off`, `proxy_read_timeout 600s`)
- Cutover: flip `/` to :5173/:4000, keep :3080 2w rollback.

## Balances & Presets (slice 3)
- `GET /api/balances/me` (+ `/api/balances/`) auto-creates `balances` row `tokenCredits 0`; `GET /api/balances/transactions?limit=&offset=` lists ledger.
- `GET/POST /api/presets`, `GET/PATCH/DELETE /api/presets/:id` — user-scoped JSONB presets; see `docs/billing.md` + `/doc#presets`.
- Web: `Sidebar` embeds `BalanceWidget` (jade card + tx toggle) + `PresetsModal` (plum) via `lib/balances.ts` / `lib/presets.ts`.

## File upload
`POST /api/files/upload` multipart `file` → `./uploads` (shared `../librechat/uploads` via volume). `hono/body-limit` 20MB.

## Chat completions SSE
`POST /api/messages/chat/completions` {model,messages,stream,conversationId?} → proxies `QWEN_PROXY_URL/compatible-mode/v1/chat/completions` with `DASHSCOPE_API_KEY`, persists `messages` rows, streams `text/event-stream`.

## Deploy / Rollback
Shadow mode: both stacks run, Postgres empty. Migrate via `scripts/migrate-mongo-to-postgres.mjs`. Keep dormant until cutover.

## Troubleshooting
- `EADDRINUSE :4000` in tests: guard `serve` with `if (NODE_ENV!=="test" && !VITEST)`.
- `BETTER_AUTH_SECRET` too short: ≥32 chars.
- `psql: command not found`: use `docker exec pragmatic-postgres psql -U pragmatic -d pragmatic -c "\dt"`.
- `Interactive prompts require TTY`: regen `drizzle` non-interactively via removing `drizzle/` then `npx drizzle-kit generate`.
