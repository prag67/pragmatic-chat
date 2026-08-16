import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchBar } from '../src/components/SearchBar';
import { ModelSelector } from '../src/components/ModelSelector';

function qc(){ return new QueryClient({ defaultOptions:{ queries:{ retry:false } } }); }

describe('SearchBar', ()=>{
  it('renders input', async()=>{
    global.fetch = vi.fn(async (url:any)=>{
      const u = typeof url==='string'?url:url.url;
      if(String(u).includes('/api/search')) return new Response(JSON.stringify({ conversations:[{id:'c1', title:'hello', snippet:'hello'}], messages:[], files:[] }), { status:200, headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify({}), { status:200, headers:{'content-type':'application/json'}});
    }) as any;
    render(<QueryClientProvider client={qc()}><SearchBar/></QueryClientProvider>);
    const input = screen.getByPlaceholderText(/ค้นหา/);
    expect(input).toBeTruthy();
    fireEvent.change(input, { target:{ value:'hello' }});
    await waitFor(()=> expect((global.fetch as any).mock.calls.some((c:any)=> String(c[0]).includes('/api/search'))).toBe(true));
  });
});

describe('ModelSelector', ()=>{
  it('lists models', async()=>{
    global.fetch = vi.fn(async ()=> new Response(JSON.stringify({ object:'list', data:[{id:'qwen-plus', object:'model'},{id:'qwen-max', object:'model'}]}), { status:200, headers:{'content-type':'application/json'}})) as any;
    render(<QueryClientProvider client={qc()}><ModelSelector value="qwen-plus" onChange={()=>{}} /></QueryClientProvider>);
    expect(await screen.findByText('qwen-plus')).toBeTruthy();
  });
});
