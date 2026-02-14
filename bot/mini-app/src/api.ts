const API_BASE = import.meta.env.VITE_CONVEX_URL || '';

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const initData = window.Telegram?.WebApp?.initData || '';
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-Telegram-Init-Data': initData },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const initData = window.Telegram?.WebApp?.initData || '';
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
