import { useEffect, useRef, useState } from 'react';
import { useConversation, streamChat, uploadFile } from '../lib/conversations';
import { apiJson } from '../lib/api';
import { Button } from './ui/button';
import { Textarea } from './ui/input';
import { Badge } from './ui/badge';
import { useQueryClient } from '@tanstack/react-query';

function MessageBubble({ role, content }: { role:string; content:string }){
  const isUser = role==='user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-soft border ${isUser ? 'bg-ink text-white border-ink-800' : 'bg-white border-sand-200'}`}>
        <div className="whitespace-pre-wrap break-words">{content}</div>
      </div>
    </div>
  );
}

export function ChatView({ id, onCreated }: { id: string | null; onCreated?: (newId:string)=>void }){
  const qc = useQueryClient();
  const { data: convo } = useConversation(id);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const messages = convo?.messages ?? [];
  const displayMessages = streaming ? [...messages, { id:'streaming', role:'assistant', content: streaming } as any] : messages;

  useEffect(()=>{ scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior:'smooth' }); },[messages.length, streaming]);

  const send = async()=>{
    if(!input.trim() || busy) return;
    const text = input.trim();
    setInput('');
    setBusy(true);
    setStreaming('');

    // if no conversation, create one first via /api/conversations then use its id
    let convId = id;
    if(!convId){
      try{
        // apiJson already imported statically
        const c = await apiJson('/api/conversations',{method:'POST', body: JSON.stringify({ title: text.slice(0,40) })}) as any;
        convId = c.id;
        onCreated?.(convId as string);
      }catch(e:any){ setStreaming(`ข้อผิดพลาดสร้างบทสนทนา: ${e.message}`); setBusy(false); return; }
    }

    const history = [...messages.map(m=>({role:m.role, content:m.content})), { role:'user', content: text }];
    let acc='';
    try{
      await streamChat({ conversationId: convId!, messages: history }, (delta)=>{ acc+=delta; setStreaming(acc); });
    }catch(e:any){
      setStreaming(prev=> prev || `ผิดพลาด: ${e.message}`);
    } finally {
      setBusy(false);
      setStreaming('');
      qc.invalidateQueries({queryKey:['conversation', convId]});
      qc.invalidateQueries({queryKey:['conversations']});
    }
  };

  const onFile = async(e:any)=>{
    const f = e.target.files?.[0] as File | undefined;
    if(!f) return;
    try{ const r = await uploadFile(f); setInput(prev=> prev + (prev?' ':'') + `[ไฟล์: ${r.originalName}]`); } catch(ex:any){ alert(ex.message); }
    e.target.value='';
  };

  if(!id){
    return (
      <div className="h-full grid place-items-center p-8">
        <div className="max-w-lg text-center space-y-4">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-jade text-white place-items-center text-xl shadow-lifted">✦</div>
          <h2 className="text-2xl font-semibold font-display">เริ่มบทสนทนาใหม่</h2>
          <p className="text-sm text-mist-500">พิมพ์ข้อความด้านล่าง — ระบบจะสตรีมคำตอบผ่าน <code className="bg-sand-100 px-1.5 py-0.5 rounded">POST /api/messages/chat/completions</code> (Qwen proxy) และบันทึกลง Postgres อัตโนมัติ</p>
          <div className="flex gap-2 justify-center text-xs">
            <Badge>qwen-plus</Badge><Badge variant="plum">pgvector</Badge><Badge>ไทย</Badge>
          </div>
          <div className="pt-2">
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft p-3 flex gap-2 items-end">
              <Textarea placeholder="พิมพ์ข้อความ… (Enter เพื่อส่ง, Shift+Enter บรรทัดใหม่)" value={input} onChange={(e:any)=>setInput(e.target.value)} onKeyDown={(e:any)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }} />
              <Button variant="jade" onClick={send} disabled={busy || !input.trim()}>ส่ง</Button>
            </div>
            <label className="mt-3 inline-flex text-xs text-jade cursor-pointer hover:underline"><input type="file" className="hidden" onChange={onFile} />แนบไฟล์ (multipart → ./uploads)</label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-sand-200 bg-white/80 backdrop-blur sticky top-0 flex items-center justify-between px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-ink text-white grid place-items-center text-sm">💬</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{convo?.title || 'บทสนทนา'}</div>
            <div className="text-xs text-mist-500">{convo?.model || 'qwen-plus'} • {messages.length} ข้อความ</div>
          </div>
        </div>
        <div className="flex items-center gap-2"><Badge variant="sand">{busy ? 'กำลังสตรีม…' : 'พร้อม'}</Badge></div>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-sand">
        {displayMessages.map((m:any)=> <MessageBubble key={m.id} role={m.role} content={m.content} />)}
        {displayMessages.length===0 && <div className="text-sm text-mist-500 text-center py-10">ยังไม่มีข้อความ — เริ่มพิมพ์ด้านล่าง</div>}
        {busy && !streaming && <div className="flex items-center gap-2 text-xs text-mist-500"><span className="h-2 w-2 rounded-full bg-jade animate-pulseDot" /> กำลังคิด…</div>}
      </div>

      <div className="p-3 sm:p-4 border-t border-sand-200 bg-white">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <label className="h-10 w-10 grid place-items-center rounded-xl border border-sand-200 bg-sand-100 hover:bg-sand-200 cursor-pointer shrink-0"><input type="file" className="hidden" onChange={onFile} />📎</label>
          <Textarea placeholder="พิมพ์ข้อความ… (Enter ส่ง)" value={input} onChange={(e:any)=>setInput(e.target.value)} onKeyDown={(e:any)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }} />
          <Button variant="jade" onClick={send} disabled={busy || !input.trim()} className="shrink-0">{busy ? '…' : 'ส่ง'}</Button>
        </div>
        <div className="max-w-3xl mx-auto text-[11px] text-mist-500 mt-2 flex gap-3"><span>SSE ผ่าน POST /api/messages/chat/completions</span><span>•</span><span>Qwen + pgvector</span></div>
      </div>
    </div>
  );
}
