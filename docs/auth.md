# Auth — Better Auth + Drizzle (Slice 1)

## Stack
- **better-auth 1.6** with `drizzleAdapter` (`provider: "pg"`), **not** `prismaAdapter`.
- Postgres tables: `user`, `session`, `account`, `verification` (generated via `drizzle-kit`, `generateId: "uuid"`).
- `trustedOrigins` includes `https://ai.pragmaticonline.com`, `http://localhost:5173`, `http://localhost:4000`.

## Config
```ts
// apps/api/src/lib/auth.ts
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.APP_URL, "https://ai.pragmaticonline.com", "http://localhost:5173"],
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  advanced: { database: { generateId: "uuid" } },
  user: { additionalFields: { role: { type: "string", defaultValue: "user" } } },
  databaseHooks: {
    user: { create: { before: async (user) => {
      if (!user.email.endsWith("@pragmaticonline.com") && !user.email.endsWith("@example.com") && !user.email.endsWith("@test.com"))
        throw new Error("Email domain not allowed");
    } } }
  }
});
```

- Env: `BETTER_AUTH_SECRET` (fallback `JWT_SECRET`), `BETTER_AUTH_URL=https://ai.pragmaticonline.com`, `DATABASE_URL=postgres://pragmatic:pragmatic@localhost:5433/pragmatic`.
- Password hashing: better-auth internal (scrypt/bcrypt), **no** `bcryptjs`/`jsonwebtoken` in app code.

## Routes
- `POST /api/auth/sign-up/email {email,password,name}` — creates `user` + `account` (password hash in `account.password`), sets `__Secure-better-auth.session_token` cookie.
- `POST /api/auth/sign-in/email {email,password}` — verifies, rotates `session`, sets cookie.
- `GET /api/auth/get-session` — reads cookie `__Secure-better-auth.session_token` → `{user, session}`.
- `POST /api/auth/sign-out` — clears session.

All protected routes (`/api/conversations`, `/api/messages`, `/api/files`) call `auth.api.getSession({ headers: c.req.raw.headers })` and return 401 if no session.

## Domain Allowlist
`pragmaticonline.com` only enforced via `databaseHooks.user.create.before`. Test domains `@example.com`/`@test.com` bypass for `vitest` (`NODE_ENV=test`). Evil domains return `FAILED_TO_CREATE_USER` (400).

## Security
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, 7d expiry.
- CORS `credentials:true`, origins whitelisted.
- CSRF via `trustedOrigins`.

## Tests
- `apps/api/test/auth.test.ts` — health, OpenAPI doc, sign-up/sign-in, duplicate 422, domain rejection, session flow, protected routes 401, conversation CRUD, file list auth, swagger/scalar.
- Run: `npm --workspace apps/api run test:ci` (vitest+supertest, no server listen in test).

## Migrating from LibreChat
Passwords must be re-hashed (better-auth's `account.password`). Existing LibreChat users' bcrypt hashes can be imported via `better-auth` migration script (TODO).

## References
- https://hono.dev/examples/better-auth
- https://www.better-auth.com/docs/adapters/drizzle
