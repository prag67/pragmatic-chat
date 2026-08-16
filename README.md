# Pragmatic v2 — Hono + Postgres (side-by-side with LibreChat)

Brand-new codebase, zero LibreChat UI/code. Runs **alongside** `/opt/librechat` on different ports.

- **Legacy LibreChat**: `http://127.0.0.1:3080` (Mongo :27017)
- **New API (Hono)**: `http://127.0.0.1:4000` → `GET /health`
- **New Web (Vite React)**: `http://127.0.0.1:5173`
- **New Postgres**: `127.0.0.1:5433` (pgvector/pg16, db `pragmatic`)
- **New Redis**: `127.0.0.1:6380`

## Quick start (side-by-side)

```bash
cd /opt/pragmatic
cp .env.example .env   # set DASHSCOPE_API_KEY, JWT_SECRET
docker compose up pragmatic-postgres pragmatic-redis -d
npm install
npm --workspace apps/api run db:generate  # after editing schema
npm --workspace apps/api run db:migrate
npm run dev  # runs api :4000 + web :5173 concurrently
# or docker compose up pragmatic-api pragmatic-web
```

## Cutover plan

1. **Shadow mode** (now): both stacks run, new Postgres empty.
2. **Migrate**: `node scripts/migrate-mongo-to-postgres.mjs` copies users/conversations/messages/files from `mongodb://127.0.0.1:27017/LibreChat` → Postgres.
3. **Dual-write / proxy**: nginx routes `ai.pragmaticonline.com` → `:3080` (legacy) and `/v2/*` → `:5173` or `:4000`.
4. **Cutover**: flip nginx to `proxy_pass http://127.0.0.1:5173` + `api` to `:4000`. Keep legacy `:3080` for rollback 2 weeks.

## Why Hono + Postgres

- Hono is edge-ready, typed RPC, OpenAPI — LibreChat Express is kept only for legacy.
- Postgres + Drizzle gives you transactions for balances/billing (LibreChat Mongo had race issues).
- Shares `qwen-proxy:8081` and `uploads` volume with legacy for zero-downtime file access.

## LibreChat origin

This repo is intentionally disjoint — no `librechat-*` packages. Keep `LICENSE` with `Copyright (c) 2023 LibreChat` per MIT if you reuse any logic.
