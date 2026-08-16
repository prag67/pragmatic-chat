import { useQuery } from '@tanstack/react-query';
import { apiJson } from './api';

export type Balance = { userId: string; tokenCredits: number; updatedAt: string };
export type Transaction = { id: string; userId: string; amount: number; type: string; reason: string | null; createdAt: string };

export function useBalance() {
  return useQuery({ queryKey: ['balance'], queryFn: () => apiJson('/api/balances/me') as Promise<Balance> });
}
export function useTransactions(limit = 20) {
  return useQuery({ queryKey: ['transactions', limit], queryFn: () => apiJson(`/api/balances/transactions?limit=${limit}`) as Promise<Transaction[]> });
}
