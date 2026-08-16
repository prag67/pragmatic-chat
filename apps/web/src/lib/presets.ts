import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiJson } from './api';

export type Preset = { id: string; userId: string; title: string; data: Record<string, any>; createdAt: string };

export function usePresets() {
  return useQuery({ queryKey: ['presets'], queryFn: () => apiJson('/api/presets') as Promise<Preset[]> });
}
export function useCreatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; data: Record<string, any> }) => apiJson('/api/presets', { method: 'POST', body: JSON.stringify(payload) }) as Promise<Preset>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presets'] }),
  });
}
export function useUpdatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }: { id: string; title?: string; data?: Record<string, any> }) => apiJson(`/api/presets/${id}`, { method: 'PATCH', body: JSON.stringify(rest) }) as Promise<Preset>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presets'] }),
  });
}
export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/api/presets/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presets'] }),
  });
}
