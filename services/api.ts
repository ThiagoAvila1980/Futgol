const resolveBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const port = window.location.port || '';
    // In dev (vite on 3000), use proxy by keeping base empty
    if (port === '3000') return '';
  }
  const envUrl = process.env.API_BASE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol || 'http:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:8000`;
  }
  return 'http://localhost:8000';
};

const BASE_URL = resolveBaseUrl().replace(/\/$/, '');

const TOKEN_KEY = 'futgol_jwt_token';

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export function setToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: any) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: any) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};

export default api;
