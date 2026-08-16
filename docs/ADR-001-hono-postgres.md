# ADR-001: Hono + Postgres + Better Auth + OpenAPI

- Date: 2026-08-16
- Status: Accepted (Slice 1)
- Context: LibreChat v0.8.7 uses Express + Mongoose + Mongo + connect-mongo + bcrypt + jsonwebtoken, ~30 Mongoose models, file upload to `uploads/`. Goal: brand-new project not recognizable as LibreChat, new design system, side-by-side shadow → migrate → flip nginx, keep :3080 2w rollback.
- Decision:
  - **API**: Hono 4.7 + `@hono/node-server` on :4000, `hono/logger` + `hono/cors`, grouped routes (`health`, `auth`, `conversations`, `messages`, `files`).
  - **Auth**: `better-auth@1.6` with `drizzleAdapter` (`provider: "pg"`, `generateId: "uuid"`), `trustedOrigins: [https://ai.pragmaticonline.com, http://localhost:5173]`, `emailAndPassword.enabled`, `pragmaticonline.com` allowlist via `databaseHooks.user.create.before`. Drop `bcryptjs`/`jsonwebtoken`.
  - **DB**: Postgres 16 `pgvector/pgvector:0.8.0-pg16` on :5433 (db `pragmatic`), Drizzle ORM 0.44 + `drizzle-kit` 0.31. Tables: `user`, `session`, `account`, `verification` (better-auth) + `conversations`, `messages`, `files`, `balances`, `transactions`, `presets`. `uuid` PKs.
  - **OpenAPI**: `OpenAPIHono` + `@hono/zod-openapi` `createRoute(...).openapi`, `app.doc('/doc')` + `@hono/swagger-ui` at `/ui` + `@scalar/hono-api-reference` at `/scalar`. Example: https://hono.dev/examples/zod-openapi, /scalar, /swagger-ui, /file-upload, /proxy, /grouping-routes-rpc, /better-auth.
  - **File upload**: Hono `c.req.parseBody()` + `hono/body-limit` 20MB, multipart → `./uploads` shared with `../librechat/uploads`.
  - **SSE proxy**: `POST /api/messages/chat/completions` verifies `auth.api.getSession`, persists user+assistant placeholder `messages`, proxies to `QWEN_PROXY_URL/compatible-mode/v1/chat/completions` (`DASHSCOPE_API_KEY`), streams `text/event-stream` via `ReadableStream`, accumulates SSE delta to update DB.
  - **Tests**: `vitest` + `supertest` (api), `React Testing Library` + `Playwright` (web), `npm test` CI. No server listen when `NODE_ENV=test`/`VITEST`.
  - **Infra**: docker-compose `pragmatic-postgres:5433`, `pragmatic-redis:6380`, systemd `pragmatic-api`/:4000, `pragmatic-web`/:5173 (Vite preview `base:'/v2/'`), nginx `ai.pragmaticonline.com`: `/` → :3080 (LibreChat), `/v2/` → :5173, `/v2/health` & `/v2/api/` → :4000, keep dormant until cutover.
- Consequences:
  - Typed OpenAPI + `zod` validation, auto docs.
  - Postgres transactions for balances/billing, JSONB flexibility, pgvector for RAG.
  - Better Auth handles hashing/sessions/cookies correctly vs custom JWT.
  - Requires `npx @better-auth/cli generate`-style schema sync and Mongo→Postgres migration script rewrite.
- Alternatives considered: Express+Prisma (heavier), Auth.js (less Hono-native), keep Mongo (no transactions).

## Slice 1 Deliverables
- `src/lib/auth.ts` + `src/db/schema.ts` better-auth+drizzle, `src/index.ts` OpenAPIHono, `src/modules/*` openapi+auth+proxy+multipart.
- `apps/api/test/auth.test.ts` 11 tests, `docs/auth.md`, `docs/SETUP.md`, OpenAPI at `/doc`.
