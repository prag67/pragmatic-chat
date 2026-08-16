import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { BalanceWidget } from '../src/components/BalanceWidget';
import { PresetsModal } from '../src/components/PresetsModal';
import { AuthProvider } from '../src/lib/auth';

function qc(){ return new QueryClient({ defaultOptions:{ queries:{ retry:false } } }); }

const mockFetchWith = (map: Record<string, any>) => {
  global.fetch = vi.fn(async (url:any)=>{
    const u = typeof url === 'string' ? url : url.url;
    for(const k of Object.keys(map)){
      if(u.includes(k)) return new Response(JSON.stringify(map[k]), { status: 200, headers:{ 'content-type':'application/json' } });
    }
    if(typeof u === 'string' && u.includes('/api/auth/get-session'))
      return new Response(JSON.stringify({ user:{ id:'u1', email:'a@pragmaticonline.com', name:'A', role:'user' }, session:{ token:'x' } }), { status:200, headers:{ 'content-type':'application/json' } });
    if(typeof u === 'string' && u.includes('/api/conversations'))
      return new Response(JSON.stringify([]), { status:200, headers:{ 'content-type':'application/json' } });
    if(typeof u === 'string' && u.includes('/api/balances/me'))
      return new Response(JSON.stringify({ userId:'u1', tokenCredits:0, updatedAt: new Date().toISOString() }), { status:200, headers:{ 'content-type':'application/json' } });
    if(typeof u === 'string' && u.includes('/api/balances/transactions'))
      return new Response(JSON.stringify([]), { status:200, headers:{ 'content-type':'application/json' } });
    if(typeof u === 'string' && u.includes('/api/presets'))
      return new Response(JSON.stringify([]), { status:200, headers:{ 'content-type':'application/json' } });
    return new Response(JSON.stringify({}), { status:200, headers:{ 'content-type':'application/json' } });
  }) as any;
};

describe('BalanceWidget', ()=>{
  beforeEach(()=>{ vi.restoreAllMocks(); });
  it('renders credits from /api/balances/me', async()=>{
    mockFetchWith({
      '/api/balances/me': { userId:'u1', tokenCredits: 1234, updatedAt: new Date().toISOString() },
      '/api/balances/transactions': [],
    });
    render(<QueryClientProvider client={qc()}><AuthProvider><BalanceWidget/></AuthProvider></QueryClientProvider>);
    expect(await screen.findByText(/เครดิตคงเหลือ/)).toBeTruthy();
    expect(await screen.findByText(/1234/)).toBeTruthy();
  });
});

describe('PresetsModal', ()=>{
  it('renders presets button and lists presets', async()=>{
    mockFetchWith({
      '/api/presets': [{ id:'p1', userId:'u1', title:'My preset', data:{ model:'qwen-plus' }, createdAt: new Date().toISOString() }],
      '/api/balances/me': { userId:'u1', tokenCredits:0, updatedAt: new Date().toISOString() },
    });
    render(<QueryClientProvider client={qc()}><PresetsModal/></QueryClientProvider>);
    expect(screen.getByText(/พรีเซ็ต/)).toBeTruthy();
    (screen.getByText(/พรีเซ็ต/) as HTMLElement).click();
    expect(await screen.findByText(/พรีเซ็ตของคุณ/)).toBeTruthy();
  });
});
