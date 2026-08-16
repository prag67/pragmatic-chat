import { useConversations, useCreateConversation, useDeleteConversation } from '../lib/conversations';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useAuth } from '../lib/auth';
import { BalanceWidget } from './BalanceWidget';
import { PresetsModal } from './PresetsModal';
import { SearchBar } from './SearchBar';
import { AdminPanel } from './AdminPanel';

export function Sidebar({ selected, onSelect }: { selected: string | null; onSelect: (id:string|null)=>void }){
  const { user } = useAuth();
  const { data: convs, isLoading } = useConversations();
  const create = useCreateConversation();
  const del = useDeleteConversation();

  if(!user) return null;

  return (
    <aside className="flex flex-col h-full">
      <div className="p-3 space-y-3">
        <Button variant="jade" className="w-full" onClick={async()=>{
          const c = await create.mutateAsync({ title: 'บทสนทนาใหม่' });
          onSelect(c.id);
        }} disabled={create.isPending}>
          <span className="mr-2">✦</span> บทสนทนาใหม่
        </Button>
        <SearchBar />
        <BalanceWidget />
        <PresetsModal />
        <AdminPanel />
      </div>
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {isLoading && <div className="text-xs text-mist-500 p-3">โหลด…</div>}
        {convs?.map(c=>(
          <div key={c.id} className={`group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border ${selected===c.id ? 'bg-white border-jade/20 shadow-soft' : 'border-transparent hover:bg-white/60'}`} onClick={()=>onSelect(c.id)}>
            <div className={`h-7 w-7 grid place-items-center rounded-lg text-xs font-semibold ${selected===c.id ? 'bg-jade text-white' : 'bg-sand-200 text-ink-800'}`}>{c.title?.[0] ?? '💬'}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium">{c.title || 'ไม่มีชื่อ'}</div>
              <div className="text-[11px] text-mist-500 truncate">{new Date(c.updatedAt).toLocaleString('th-TH')}</div>
            </div>
            <button className="opacity-0 group-hover:opacity-100 text-mist-500 hover:text-red-600 p-1" onClick={(e)=>{ e.stopPropagation(); if(confirm('ลบการสนทนา?')) del.mutate(c.id, { onSuccess: ()=> selected===c.id && onSelect(null) }); }}>×</button>
          </div>
        ))}
        {convs?.length===0 && <div className="text-xs text-mist-500 p-4 text-center border border-dashed border-sand-300 rounded-xl bg-white/40">ยังไม่มีบทสนทนา — กด “บทสนทนาใหม่”</div>}
      </div>
      <div className="p-3 border-t border-sand-200 text-[11px] text-mist-500">
        <div className="flex items-center gap-2"><Badge variant="sand">v2</Badge> <span>Hono + Postgres</span></div>
        <div className="mt-2 flex gap-2">
          <a className="underline" href="/doc" target="_blank">API doc</a>
          <span>·</span>
          <a className="underline" href="/scalar" target="_blank">Scalar</a>
        </div>
      </div>
    </aside>
  );
}
