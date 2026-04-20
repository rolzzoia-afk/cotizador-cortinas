import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

type Json = Record<string, unknown> | unknown[];

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Json,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Json) => request<T>('POST', path, body),
  put: <T>(path: string, body?: Json) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
