import { useState } from 'react';
import { useSearch } from '../lib/search';
import { useNavigate } from 'react-router-dom';

export function SearchBar(){
  const [q, setQ] = useState('');
  const { data, isLoading } = useSearch(q);
  const has = q.trim().length>=2 && data;
  return (
    <div className="relative w-full">
      <input placeholder="ค้นหา… conversaciones / messages / files" value={q} onChange={e=>setQ(e.target.value)} className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-jade/20 outline-none" />
      {has && (
        <div className="absolute mt-1 w-full rounded-xl border border-sand-200 bg-white shadow-lifted max-h-64 overflow-y-auto z-20">
          {isLoading && <div className="p-2 text-xs text-mist-500">ค้นหา…</div>}
          {data?.conversations?.length===0 && data?.messages?.length===0 && data?.files?.length===0 && <div className="p-3 text-xs text-mist-500 text-center">ไม่พบผลลัพธ์</div>}
          {data?.conversations?.map(c=> <div key={c.id} className="px-3 py-2 text-xs border-b border-sand-100"><span className="font-medium">{c.title || 'ไม่มีชื่อ'}</span> <span className="text-mist-500">— {c.snippet}</span></div>)}
          {data?.messages?.map(m=> <div key={m.id} className="px-3 py-2 text-xs border-b border-sand-100"><span className="px-1.5 py-0.5 rounded bg-sand-100 mr-1">{m.role}</span>{m.snippet}</div>)}
          {data?.files?.map(f=> <div key={f.id} className="px-3 py-2 text-xs border-b border-sand-100">📎 {f.originalName}</div>)}
        </div>
      )}
    </div>
  );
}
