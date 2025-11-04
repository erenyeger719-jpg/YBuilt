// server/intent/cache2.ts
import * as crypto from "node:crypto";

type Entry<T> = { value: T; expires: number };

export class TTLCache<T = any> {
  private store = new Map<string, Entry<T>>();
  constructor(
    private max = parseInt(process.env.CACHE_MAX_ENTRIES || "2000", 10),
    private ttl = parseInt(process.env.CACHE_TTL_MS || "600000", 10) // 10m
  ) {}
  get(key: string): T | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expires) {
      this.store.delete(key);
      return null;
    }
    // LRU bump
    this.store.delete(key);
    this.store.set(key, e);
    return e.value;
  }
  set(key: string, val: T) {
    if (this.store.size >= this.max) {
      const first = this.store.keys().next().value;
      if (first) this.store.delete(first);
    }
    this.store.set(key, { value: val, expires: Date.now() + this.ttl });
  }
  clear() {
    this.store.clear();
  }
}

function stable(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stable);
  const out: any = {};
  for (const k of Object.keys(obj).sort()) out[k] = stable(obj[k]);
  return out;
}

function canonicalizePrompt(s: string) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

export function cacheKey(payload: any) {
  const str = JSON.stringify(stable(payload));
  return crypto.createHash("sha256").update(str).digest("hex");
}

/**
 * makeKeyFromRequest
 *
 * Backwards-compatible:
 * - Old style: makeKeyFromRequest(path, body, extra?)
 * - New style: makeKeyFromRequest(req, extra?)
 *   where req is an Express-like Request (has path, headers, body).
 *
 * In the new style we pull x-workspace-id from headers so cache
 * entries are scoped per workspace.
 */
export function makeKeyFromRequest(
  reqOrPath: any,
  bodyOrExtra?: any,
  maybeExtra?: any
) {
  let path: string;
  let body: any;
  let extra: any;
  let workspaceId = "";

  if (typeof reqOrPath === "string") {
    // Legacy call: (path, body, extra?)
    path = reqOrPath;
    body = bodyOrExtra || {};
    extra = maybeExtra || {};
    // If caller manually threads workspaceId via extra, keep honoring it
    if (extra && typeof extra.workspaceId === "string") {
      workspaceId = extra.workspaceId;
    }
  } else {
    // New call: (req, extra?)
    const req = reqOrPath as {
      path?: string;
      headers?: Record<string, any>;
      body?: any;
    };
    path = req.path || "";
    body = req.body || {};
    extra = bodyOrExtra || {};

    const rawWs = req.headers?.["x-workspace-id"];
    workspaceId = Array.isArray(rawWs)
      ? (rawWs[0] || "").toString().trim()
      : (rawWs || "").toString().trim();
  }

  return cacheKey({
    path,
    prompt: canonicalizePrompt(body?.prompt || body?.user || ""),
    copy: body?.copy || {},
    extra: extra || {},
    // separate dimension so tenants don't share cache entries
    workspaceId: workspaceId || undefined,
  });
}

export const sharedCache = new TTLCache<any>();
