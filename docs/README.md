# Pragmatic Chat — Hono + Postgres (v2)

Brand-new codebase at https://github.com/prag67/pragmatic-chat, served at https://ai.pragmaticonline.com/v2/ side-by-side with LibreChat at `/`.

## Quick start
```bash
git clone https://github.com/prag67/pragmatic-chat.git
cd pragmatic-chat
cp .env.example .env
docker compose up pragmatic-postgres pragmatic-redis -d
npm install
npm --workspace apps/api run db:migrate
npm run dev # api :4000 + web :5173
```

## Architecture
- `apps/api` — Hono 4, Drizzle ORM, Postgres pgvector, Zod OpenAPI, JWT
- `apps/web` — Vite React, Tailwind, TanStack Query, Thai i18n
- `scripts/migrate-mongo-to-postgres.mjs` — one-off Mongo → Postgres

## ADRs
- `docs/ADR-001-hono-postgres.md` — why Hono+Postgres over Express+Mongo
- `docs/auth.md` — auth flow (this slice)
