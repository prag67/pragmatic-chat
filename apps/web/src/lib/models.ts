import { useQuery } from '@tanstack/react-query';
import { apiJson } from './api';
export type Model = { id: string; object: string; owned_by?: string };
export function useModels(){
  return useQuery({ queryKey: ['models'], queryFn: ()=> apiJson('/api/models') as Promise<{ object: string; data: Model[] }>, staleTime: 60000 });
}
