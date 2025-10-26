// server/intent/cache.ts
type Entry<T> = { value: T; ts: number };

const INTENT_CACHE = new Map<string, Entry<any>>();

export function normalizeKey(s: string) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 800);
}

export function cacheGet<T>(key: string, maxAgeMs = 10 * 60_000): T | null {
  const hit = INTENT_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > maxAgeMs) { INTENT_CACHE.delete(key); return null; }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, maxSize = 400) {
  if (INTENT_CACHE.size >= maxSize) {
    const first = INTENT_CACHE.keys().next().value;
    if (first) INTENT_CACHE.delete(first);
  }
  INTENT_CACHE.set(key, { value, ts: Date.now() });
}
