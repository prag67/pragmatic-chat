import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BalanceWidget } from '../src/components/BalanceWidget';
import { AuthProvider } from '../src/lib/auth';

function qc(){ return new QueryClient({ defaultOptions:{ queries:{ retry:false } } }); }

describe('Files embedding (pseudo)', ()=>{
  it('BalanceWidget still renders after file upload mock', async()=>{
    global.fetch = vi.fn(async (url:any)=>{
      const u = typeof url==='string'?url:url.url;
      if(String(u).includes('/api/balances/me')) return new Response(JSON.stringify({ userId:'u1', tokenCredits:42, updatedAt: new Date().toISOString()}), { status:200, headers:{'content-type':'application/json'}});
      if(String(u).includes('/api/balances/transactions')) return new Response(JSON.stringify([]), { status:200, headers:{'content-type':'application/json'}});
      if(String(u).includes('/api/auth/get-session')) return new Response(JSON.stringify({ user:{ id:'u1', email:'a@pragmaticonline.com', name:'A', role:'user'}, session:{}}), { status:200, headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify({}), { status:200, headers:{'content-type':'application/json'}});
    }) as any;
    render(<QueryClientProvider client={qc()}><AuthProvider><BalanceWidget/></AuthProvider></QueryClientProvider>);
    expect(await screen.findByText(/42/)).toBeTruthy();
  });
});
