// server/llm/cache.ts
type Row<T> = { v: T; exp: number };
const MAX = parseInt(process.env.LLM_CACHE_MAX || "500", 10);
const TTL_MS = parseInt(process.env.LLM_CACHE_TTL_SEC || "900", 10) * 1000; // default 15m

const store = new Map<string, Row<any>>();

export function getJSON<T = any>(key: string): T | null {
  const row = store.get(key);
  if (!row) return null;
  if (row.exp < Date.now()) { store.delete(key); return null; }
  // LRU bump
  store.delete(key); store.set(key, row);
  return row.v as T;
}

export function setJSON<T = any>(key: string, v: T, ttlMs: number = TTL_MS) {
  if (store.size >= MAX) {
    // drop oldest
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
  store.set(key, { v, exp: Date.now() + ttlMs });
}

export function flushLLMCache() { store.clear(); }
