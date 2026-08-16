import { useQuery } from '@tanstack/react-query';
import { apiJson } from './api';
export type SearchResult = { conversations: { id:string; title:string|null; snippet:string|null }[]; messages: { id:string; conversationId:string; role:string; snippet:string }[]; files: { id:string; originalName:string; filename:string }[] };
export function useSearch(q: string){
  return useQuery({ queryKey:['search', q], queryFn: ()=> apiJson(`/api/search?q=${encodeURIComponent(q)}`) as Promise<SearchResult>, enabled: q.trim().length>=2 });
}
