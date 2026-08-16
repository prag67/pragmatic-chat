# Web — TanStack Query + SSE (Slice 2)

## Stack
- Vite 6 + React 18 + React Router 7 + TanStack Query 5 + Tailwind + `better-auth` via fetch
- `base:'/v2/'`, `preview.allowedHosts:true`, dev proxy `/api → http://localhost:4000`

## API Layer
`apps/web/src/lib/api.ts`:
- `API_BASE = window.location.pathname.startsWith('/v2') ? '/v2' : ''`
- `apiUrl(path)` prefixes `/api /health /doc` with base
- `toAbsolute` converts relative to `http://localhost` for node/fetch in vitest
- `apiFetch(path, init)` → `fetch` with `credentials:'include'` + JSON header
- `apiJson` throws on !ok with parsed body

`apps/web/src/lib/auth.tsx`:
- `AuthProvider` calls `GET /api/auth/get-session` (credentials include) on mount, exposes `{user,loading,refresh,signOut}`
- `signUp(email,password,name)` → `POST /api/auth/sign-up/email`
- `signIn(email,password)` → `POST /api/auth/sign-in/email`
- Allowlist hint: `@pragmaticonline.com` (test `@example.com` via `better-auth` hook)

`apps/web/src/lib/conversations.ts`:
- `useConversations()` → `GET /api/conversations`
- `useConversation(id)` → `GET /api/conversations/:id` (enabled !!id)
- `useCreate/Update/DeleteConversation` mutations invalidate `['conversations']`
- `uploadFile(file)` → `POST /v2/api/files/upload` multipart `FormData` credentials include
- `streamChat({conversationId,messages,model}, onDelta)` → `POST /api/messages/chat/completions {stream:true}` → SSE parser (`data: ` lines, `JSON.parse`, `choices[0].delta.content`)

## Components
- `AuthPanel` — card with in/up toggle, email/password/name, error, `Badge` hint, signs via `signIn/signUp` then `refresh()`, shows avatar + signOut when user
- `Sidebar` — `useConversations`, `useCreateConversation`, new-chat + list (selected highlight `border-jade/20 bg-white`), delete with confirm, meta `/doc /scalar`
- `ChatView` — `useConversation(id)`, `displayMessages` (+ streaming placeholder), `streamChat` on send, auto-create conversation if `id===null` via `POST /api/conversations`, `uploadFile` adds `[ไฟล์: name]` to input, sticky header + scroller + composer (`Textarea` Enter+ShiftEnter, file input)

## App Shell
`apps/web/src/App.tsx` — `AuthProvider` → `Shell`:
- Header: brand, health (`HealthDot` → `GET /health`), user email, links
- Aside 320px: `AuthPanel` + `Sidebar`, mobile toggle
- Main: if !user → welcome card (grid sand-100), else `<ChatView id={selected} onCreated={setSelected} />`
- Footer: MIT + Shadow mode badge
- No `App.js`/`main.js` stray builds (deleted)

## Routing
`apps/web/src/main.tsx` — `QueryClientProvider` + `BrowserRouter` + `Routes /* → App`. `vite.config.ts` base `/v2/` ensures assets under `/v2/`, nginx `/v2/ → :5173` proxy.

## Tests
- `apps/web/test/App.test.tsx` — RTL: Pragmatic header, Thai heading, health dot (mock fetch for `get-session`/`health`/`conversations`)
- `apps/web/test/setup.ts` — global fetch mock returns `{user:null}` etc
- `apps/web/vitest.config.ts` jsdom, `playwright.config.ts` + `e2e/health.spec.ts` expects Pragmatic visible at `http://localhost:5173/v2/`

## Build
- `npm --workspace apps/web run build` → `tsc && vite build` → `dist/` (vite preview serves)
- `systemctl restart pragmatic-web` after build

## Env
- `APP_URL=https://ai.pragmaticonline.com` (prod), `VITE` base `/v2/`, nginx buffers off.
