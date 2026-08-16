import { useEffect, useState } from 'react';

export default function App() {
  const [health, setHealth] = useState<any>(null);
  useEffect(() => { fetch('/health').then(r=>r.json()).then(setHealth).catch(()=>setHealth({status:'api offline'})); }, []);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b sticky top-0 bg-white/80 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white grid place-items-center font-bold text-sm">P</div>
            <span className="font-semibold">Pragmatic</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">v2 · Hono + Postgres</span>
          </div>
          <nav className="text-sm text-zinc-500 flex gap-4">
            <span>API: {health?.status ?? '...'}</span>
            <a href="http://localhost:3080" target="_blank" className="underline">LibreChat (legacy :3080)</a>
          </nav>
        </div>
      </header>

      <div className="flex-1 grid md:grid-cols-[280px_1fr] max-w-6xl mx-auto w-full">
        <aside className="border-r p-4 hidden md:block">
          <button className="w-full bg-zinc-900 text-white rounded-lg py-2 text-sm font-medium">New chat</button>
          <p className="text-xs text-zinc-500 mt-4">Conversations will appear here once API is connected.</p>
          <div className="mt-6 text-xs text-zinc-400 space-y-1">
            <div>Postgres: :5433 pragmatic</div>
            <div>API: :4000 (Hono)</div>
            <div>Web: :5173 (Vite)</div>
            <div>Legacy LibreChat: :3080</div>
          </div>
        </aside>
        <main className="p-6">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-semibold">พื้นที่ทำงาน AI ของคุณ</h1>
            <p className="text-zinc-500 mt-2">Your AI Workspace — brand new codebase, zero LibreChat UI.</p>

            <div className="mt-8 rounded-xl border bg-zinc-50 p-6">
              <h2 className="font-medium">Next steps</h2>
              <ol className="list-decimal ml-5 mt-2 text-sm text-zinc-600 space-y-1">
                <li><code>docker compose up pragmatic-postgres pragmatic-redis -d</code> then <code>npm run db:migrate</code></li>
                <li><code>npm run dev:api</code> → verify <code>/health</code> shows db: up</li>
                <li>Run <code>npm run dev:web</code> and build out chat UI (streaming via <code>/api/messages/chat/completions</code> proxies qwen-proxy)</li>
                <li>Run migration script to copy Mongo users/convos into Postgres</li>
              </ol>
            </div>

            <div className="mt-6 rounded-xl border p-4 font-mono text-xs bg-white">
              <div>health: {JSON.stringify(health)}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
