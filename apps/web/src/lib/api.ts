export const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  return window.location.pathname.startsWith('/v2') ? '/v2' : '';
})();

function apiUrl(path: string){
  if (path.startsWith('/api') || path.startsWith('/health') || path.startsWith('/doc')) return `${API_BASE}${path}`;
  return path;
}

function toAbsolute(url: string){
  // Node fetch requires absolute URL; jsdom fetch also works with relative, but vitest uses node fetch
  if (url.startsWith('http')) return url;
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    // jsdom may have origin http://localhost:3000 etc; use it
    try { return new URL(url, window.location.origin).toString(); } catch {}
  }
  // fallback for node env
  return `http://localhost${url.startsWith('/') ? url : '/' + url}`;
}

export async function apiFetch(path: string, init: RequestInit = {}){
  const url = apiUrl(path);
  const fetchUrl = toAbsolute(url);
  const res = await fetch(fetchUrl, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init.headers as any) }, ...init });
  return res;
}
export async function apiJson(path: string, init: RequestInit = {}){
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    const err: any = new Error(body?.message || body?.error || `Request failed ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}
