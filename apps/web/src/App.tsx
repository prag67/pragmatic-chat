import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { AuthPanel } from './components/AuthPanel';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { apiFetch } from './lib/api';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';

function HealthDot(){
  const [h, setH] = useState<any>(null);
  useEffect(()=>{ apiFetch('/health').then(r=>r.json()).then(setH).catch(()=>setH({status:'offline', db:'down'})); },[]);
  const ok = h?.status==='ok' && h?.db==='up';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${ok?'text-jade-700':'text-amber-700'}`}>
      <span className={`h-2 w-2 rounded-full ${ok?'bg-jade animate-pulseDot':'bg-amber-500'}`} />
      API {h?.status ?? '…'} • DB {h?.db ?? '…'}
    </span>
  );
}

function Shell(){
  const { user } = useAuth();
  const [selected, setSelected] = useState<string|null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-[56px] border-b border-sand-200 bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1440px] mx-auto px-4 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden h-9 w-9 grid place-items-center rounded-xl border border-sand-200 bg-white" onClick={()=>setMobileOpen(v=>!v)}>≡</button>
            <div className="h-9 w-9 rounded-xl bg-ink text-white grid place-items-center font-bold text-sm shadow-soft">P</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold leading-none">Pragmatic</span>
                <Badge variant="jade">v2</Badge>
                <span className="hidden sm:inline text-xs text-mist-500">ช่วงเงา • side-by-side</span>
              </div>
              <div className="text-xs text-mist-500 hidden sm:block">พื้นที่ทำงาน AI ของคุณ — ดีไซน์ใหม่ ไม่ใช่ LibreChat</div>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <div className="hidden md:flex items-center gap-3">
              <HealthDot />
              <span className="h-4 w-px bg-sand-200" />
              <a href="https://ai.pragmaticonline.com/v2/doc" target="_blank" className="text-mist-500 hover:text-ink underline">OpenAPI</a>
              <a href="https://ai.pragmaticonline.com/v2/scalar" target="_blank" className="text-mist-500 hover:text-ink underline">Scalar</a>
              <a href="http://localhost:3080" target="_blank" className="hidden lg:inline text-mist-500 hover:text-ink">LibreChat :3080</a>
            </div>
            <div className="hidden sm:block h-6 w-px bg-sand-200" />
            <div className="text-xs text-mist-500 hidden sm:block">{user ? user.email : 'ยังไม่ได้เข้าสู่ระบบ'}</div>
          </nav>
        </div>
      </header>

      <div className="flex-1 max-w-[1440px] mx-auto w-full flex min-h-0">
        <aside className={`${mobileOpen ? 'flex' : 'hidden'} lg:flex w-[320px] shrink-0 border-r border-sand-200 bg-sand-100/60 flex-col lg:sticky lg:top-[56px] lg:h-[calc(100vh-56px)]`}>
          <div className="p-4 border-b border-sand-200 bg-white/60">
            <AuthPanel />
          </div>
          <div className="flex-1 min-h-0">
            <Sidebar selected={selected} onSelect={(id)=>{ setSelected(id); setMobileOpen(false); }} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 bg-sand flex flex-col lg:h-[calc(100vh-56px)]">
          {!user ? (
            <div className="flex-1 grid place-items-center p-6">
              <div className="max-w-xl w-full space-y-4">
                <div className="bg-white rounded-2xl border border-sand-200 shadow-lifted p-6">
                  <h1 className="text-2xl font-semibold font-display">ยินดีต้อนรับ — เข้าสู่ระบบด้วย @pragmaticonline.com</h1>
                  <p className="text-sm text-mist-500 mt-2">ระบบใหม่ Hono + Postgres + Better Auth • แยกจาก LibreChat โดยสิ้นเชิง • ข้อมูลเดิมยังคงอยู่ที่ :3080 เพื่อ rollback 2 สัปดาห์</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-sand-100 p-3 border border-sand-200"><div className="font-medium">Postgres :5433</div><div className="text-mist-500">pgvector</div></div>
                    <div className="rounded-xl bg-sand-100 p-3 border border-sand-200"><div className="font-medium">API :4000</div><div className="text-mist-500">OpenAPI</div></div>
                    <div className="rounded-xl bg-sand-100 p-3 border border-sand-200"><div className="font-medium">Web :5173</div><div className="text-mist-500">base /v2/</div></div>
                  </div>
                </div>
                <div className="text-center"><Button variant="ghost" onClick={()=>document.querySelector('input[type=email]')?.scrollIntoView({behavior:'smooth', block:'center'})}>ไปยังฟอร์มล็อกอินด้านซ้าย</Button></div>
              </div>
            </div>
          ) : (
            <ChatView id={selected} onCreated={setSelected} />
          )}
        </main>
      </div>

      <footer className="border-t border-sand-200 bg-white text-[11px] text-mist-500">
        <div className="max-w-[1440px] mx-auto px-4 py-2 flex flex-wrap gap-3 items-center justify-between">
          <span>© 2026 Pragmatic Online • MIT • แยกโค้ดจาก LibreChat โดยสิ้นเชิง • ดีไซน์ใหม่ (ink/jade/plum/sand)</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-jade" /> Shadow mode • ตัด nginx เมื่อพร้อม</span>
        </div>
      </footer>
    </div>
  );
}

export default function App(){
  return <AuthProvider><Shell /></AuthProvider>;
}
