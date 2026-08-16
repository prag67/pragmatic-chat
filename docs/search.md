# Search & Models & Admin (Slice 4)

## Models

`GET /api/models` — proxies `QWEN_PROXY_URL/compatible-mode/v1/models` (`DASHSCOPE_API_KEY` bearer) if reachable, else static fallback `{object:"list", data:[qwen-plus, qwen-max, qwen-turbo]}`. OpenAPI tag `models`. Web `lib/models.ts` `useModels()` + `components/ModelSelector.tsx` select; `ChatView` now tracks `model` state and passes to `streamChat({…, model})`.

## Search (ILIKE placeholder for pgvector)

`GET /api/search?q=hello&limit=10` — requires auth, searches own data only: `conversations.title ILIKE %q%`, `messages.content ILIKE %q%`, `files.original_name/filename ILIKE %q%`. Returns `{conversations:[{id,title,snippet}], messages:[{id,conversationId,role,snippet}], files:[{id,originalName,filename}]}`. Uses `drizzle sql` raw queries with `limit`. OpenAPI tag `search`. Future: replace with `pgvector` `cosine` on embeddings (`files` already store in `uploads` shared with LibreChat, add embedding column later).

Web: `lib/search.ts` `useSearch(q)` enabled when `q.length>=2`, `components/SearchBar.tsx` debounced input + dropdown rendering results. Mounted in `Sidebar` above `BalanceWidget`.

## Chat billing

`POST /api/messages/chat/completions` now deducts credits after upstream success:
- Helper `deductCredits(userId, amount, reason)` ensures `balances` row, updates `tokenCredits += amount`, inserts `transactions` (`type: usage|topup`).
- Non-stream: `tokens ≈ ceil(content.length/4)`, deduct `max(1, min(1000, tokens))` reason `chat non-stream {model}`.
- Stream: accumulate SSE `data:` chunks → extract `delta.content`, deduct on `finally` with `ceil((text||accumulated).length/4)`.
- `ChatView` invalidates `['balance']`/`['transactions']` after `streamChat` so `BalanceWidget` refreshes.

No 402 blocking yet — negative balances allowed in slice4; admin top-up will replenish.

## Admin

`apps/api/src/modules/admin.ts` — `requireAdmin(c)` fetches session via `auth.api.getSession`, checks `user.role === 'admin'` from DB (stale session fix). Routes (tag `admin`):
- `GET /api/admin/users` — list 100 newest users.
- `POST /api/admin/balances/adjust {userId, amount, reason?}` — ensure balance row, `tokenCredits += amount`, insert `transactions` (`admin_topup|admin_deduct`).
- `GET /api/admin/balances/:userId` — fetch single balance.
All return 401/403/404 as appropriate.

Web: `components/AdminPanel.tsx` toggle → lists users (query enabled only when open), select userId, input amount, mutate adjust, invalidates queries. Mounted in `Sidebar`.

## Tests & OpenAPI

`/doc` includes tags `models, search, admin, balances, presets`. Swagger ` /ui` and Scalar ` /scalar` unchanged. See `SETUP.md` for curl examples.
