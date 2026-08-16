# Billing — Balances & Transactions (Slice 3)

## Tables (Postgres `drizzle`, existing from slice 1)

```sql
balances(user_id uuid PK FK user.id, token_credits int default 0, updated_at timestamptz)
transactions(id uuid PK, user_id uuid FK user.id, amount int, type varchar(40), reason varchar(200), created_at timestamptz)
presets(id uuid PK, user_id uuid FK user.id, title varchar(200), data jsonb, created_at timestamptz)
```

`tokenCredits` is the single credit counter. Transactions are append-only ledger entries; `amount` positive = credit, negative = debit. `type` examples: `topup`, `usage`, `refund`.

## API

All routes require Better Auth session (`auth.api.getSession({ headers: c.req.raw.headers })` → 401 if missing). OpenAPI schemas in `/doc` tags `balances` / `presets`.

### Balances

- `GET /api/balances/me` — get or auto-create balance `{ userId, tokenCredits, updatedAt }`.
  - Alias: `GET /api/balances/` (same handler).
  - Logic: `SELECT * FROM balances WHERE user_id = ?` — if missing, `INSERT (user_id, tokenCredits=0) RETURNING *`.
- `GET /api/balances/transactions?limit=50&offset=0` — list current user's transactions ordered `created_at DESC`, max 100.

No write endpoint yet (top-up via Stripe/webhook will `INSERT transactions` + `UPDATE balances SET token_credits = token_credits + amount`). For tests/slice3, seed via direct DB insert.

### Presets

User-owned JSON presets for model/prompt configs (`data` jsonb).

- `GET /api/presets` — list own presets `ORDER BY created_at DESC LIMIT 100`.
- `POST /api/presets { title, data }` — create, returns 201 with `id`.
- `GET /api/presets/:id` — fetch one, scoped to `userId`; 404 if not own.
- `PATCH /api/presets/:id { title?, data? }` — partial update, scoped.
- `DELETE /api/presets/:id` — delete scoped, returns `{ ok: true }`.

Validation: `title` 1–200 chars, `data` arbitrary object (`z.record(z.any())`). Ownership enforced via `AND eq(presets.id, id), eq(presets.userId, userId)`.

## Web

- `lib/balances.ts` — `useBalance()` → `GET /api/balances/me`, `useTransactions(limit)` → `GET /api/balances/transactions`; types `Balance`, `Transaction`.
- `lib/presets.ts` — `usePresets()`, `useCreatePreset()`, `useUpdatePreset()`, `useDeletePreset()` (TanStack Query, invalidate `['presets']`).
- `components/BalanceWidget.tsx` — card showing `tokenCredits`, updated timestamp, toggle transaction history (20 rows). Uses `Badge jade`, `Card`.
- `components/PresetsModal.tsx` — `พรีเซ็ต · Presets` toggle button → card with create/edit form (title + JSON textarea), list with edit/delete, `Badge plum`. Included in `Sidebar` above conversation list.
- `components/Sidebar.tsx` — now renders `BalanceWidget` + `PresetsModal` in top `p-3` section (jade/plum/sand tokens).

## Security & scopes

- Every handler calls `getUserId(c)` via `auth.api.getSession`; no global middleware yet (grouping per `hono.dev/examples` grouping).
- No cross-user reads: `balances` is per-user PK, `transactions`/`presets` filtered by `userId`.
- Balance auto-creation avoids race: single insert with PK; concurrent requests may hit unique violation — acceptable for slice3 (future: `ON CONFLICT DO NOTHING`).

## Examples

```bash
# authenticated via __Secure-better-auth.session_token cookie
curl -b cookie.txt https://ai.pragmaticonline.com/v2/api/balances/me
curl -b cookie.txt "https://ai.pragmaticonline.com/v2/api/balances/transactions?limit=5"
curl -b cookie.txt https://ai.pragmaticonline.com/v2/api/presets
curl -b cookie.txt -X POST https://ai.pragmaticonline.com/v2/api/presets \
  -H 'Content-Type: application/json' -d '{"title":"qwen-fast","data":{"model":"qwen-plus","temperature":0.5}}'
```

## Tests

- `apps/api/test/auth.test.ts` extended: `GET /api/balances/me` 401 unauthed, create balance with auth → `tokenCredits 0`, transactions 200 empty array, presets CRUD lifecycle (create→list→patch→get→delete→404).
- Web RTL: `apps/web/test/billing.test.tsx` mocks `fetch` for `/api/balances/me`, `/api/presets`, renders `BalanceWidget` + `PresetsModal`.

## Future

- Stripe webhook `POST /api/billing/webhook` → verify, insert transaction + update balance in transaction.
- Deduct on `POST /api/messages/chat/completions` via `استهلاك` ledger.
