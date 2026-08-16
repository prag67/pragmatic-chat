import '@testing-library/jest-dom';
const originalFetch = global.fetch;
global.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.includes('/api/auth/get-session')) {
    return new Response(JSON.stringify({ user: null, session: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/health')) {
    return new Response(JSON.stringify({ status: 'ok', db: 'up' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/api/conversations')) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (originalFetch) return originalFetch(input, init);
  return new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } });
};
