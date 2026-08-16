import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiJson, apiFetch } from './api';

export type Conversation = { id:string; title:string|null; model:string|null; endpoint:string|null; createdAt:string; updatedAt:string };
export type Message = { id:string; conversationId:string; userId:string; role:'user'|'assistant'|'system'; content:string; model?:string|null; createdAt:string };

export function useConversations(){
  return useQuery({ queryKey:['conversations'], queryFn: ()=> apiJson('/api/conversations') as Promise<Conversation[]> });
}
export function useConversation(id:string|null){
  return useQuery({ queryKey:['conversation',id], queryFn: ()=> apiJson(`/api/conversations/${id}`) as Promise<Conversation & {messages: Message[]}>, enabled: !!id });
}
export function useCreateConversation(){
  const qc=useQueryClient();
  return useMutation({ mutationFn: (payload:{title?:string; model?:string})=> apiJson('/api/conversations',{method:'POST', body: JSON.stringify(payload)}) as Promise<Conversation>, onSuccess: ()=> qc.invalidateQueries({queryKey:['conversations']}) });
}
export function useUpdateConversation(){
  const qc=useQueryClient();
  return useMutation({ mutationFn: ({id, title}:{id:string; title:string})=> apiJson(`/api/conversations/${id}`,{method:'PATCH', body: JSON.stringify({title})}), onSuccess: (_d,_v)=>{ qc.invalidateQueries({queryKey:['conversations']}); qc.invalidateQueries({queryKey:['conversation', _v.id]}); } });
}
export function useDeleteConversation(){
  const qc=useQueryClient();
  return useMutation({ mutationFn: (id:string)=> apiJson(`/api/conversations/${id}`,{method:'DELETE'}), onSuccess: ()=> qc.invalidateQueries({queryKey:['conversations']}) });
}

export async function uploadFile(file: File){
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/v2') ? '/v2' : '';
  const url = `${base}/api/files/upload`;
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(url, { method:'POST', body: fd, credentials:'include' });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

// SSE streaming helper
export async function streamChat({ conversationId, messages, model, signal }: { conversationId?: string; messages: {role:string; content:string}[]; model?: string; signal?: AbortSignal }, onDelta:(chunk:string)=>void){
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/v2') ? '/v2' : '';
  const res = await apiFetch('/api/messages/chat/completions', { method:'POST', body: JSON.stringify({ conversationId, messages, model: model||'qwen-plus', stream:true }), signal });
  if(!res.ok) { const t=await res.text(); throw new Error(t); }
  const reader = res.body?.getReader();
  if(!reader) throw new Error('No stream');
  const decoder = new TextDecoder();
  let buffer='';
  while(true){
    const { done, value } = await reader.read();
    if(done) break;
    buffer += decoder.decode(value, { stream:true });
    const lines = buffer.split('\n');
    buffer = lines.pop()||'';
    for(const line of lines){
      if(!line.startsWith('data: ')) continue;
      const d=line.slice(6).trim();
      if(d==='[DONE]') return;
      try{
        const j=JSON.parse(d);
        const delta=j.choices?.[0]?.delta?.content ?? '';
        if(delta) onDelta(delta);
      }catch{}
    }
  }
}
