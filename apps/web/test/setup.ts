import '@testing-library/jest-dom';
const originalFetch = global.fetch;
global.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input as any).url;
  if (url.includes('/api/auth/get-session')) {
    return new Response(JSON.stringify({ user: null, session: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/health')) {
    return new Response(JSON.stringify({ status: 'ok', db: 'up' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/api/conversations')) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/api/balances/me') || url.includes('/api/balances/')) {
    return new Response(JSON.stringify({ userId: 'u1', tokenCredits: 0, updatedAt: new Date().toISOString() }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/api/balances/transactions')) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/api/models')) {
    return new Response(JSON.stringify({ object:'list', data:[{id:'qwen-plus', object:'model'}] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/api/search')) {
    return new Response(JSON.stringify({ conversations:[], messages:[], files:[] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/api/admin')) {
    return new Response(JSON.stringify({ error:'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/api/presets')) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (originalFetch) return originalFetch(input as any, init as any);
  return new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } });
};
