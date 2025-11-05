// server/llm/registry.ts
// Provider registry with champion/challenger + optional shadow runs.
// Supports: openai (default), granite (configurable), ollama (local).
// JSON-only outputs with brace-scrape fallback. Safe degradations and nightly routing refresh.

import fs from "fs";
import path from "path";
import { getJSON, setJSON } from "./cache.ts";
import {
  primaryModel,
  challengerModel,
  shouldRunChallenger,
} from "./eval.config.ts";
import { decideProviderEnvelope } from "./provider.envelope.ts";

// ---------- Types ----------
export type ReqLike = {
  get?: (h: string) => string | undefined;
  headers?: Record<string, string | string[] | undefined>;
};

export type ChatArgs = {
  task?: string;               // e.g., "filter", "planner", "critic"
  system: string;
  user: string;
  schema?: any;                // optional JSON Schema hint
  temperature?: number;        // default 0
  max_tokens?: number;         // soft cap per provider
  timeoutMs?: number;          // default 20000
  tags?: Record<string, any>;  // metadata (model_hint, cost tags, etc.)
  req?: ReqLike;               // read headers for overrides
};

type ChatRaw = { raw: string };
type ProviderCall = (args: ChatArgs, modelHint?: string) => Promise<ChatRaw>;
type ProviderName = "openai" | "granite" | "ollama";

type Choice = { provider: ProviderName; model?: string; key?: string };

// ---------- FS utils ----------
const CACHE_DIR = ".cache";
const ROUTING_FILE = path.join(CACHE_DIR, "llm.routing.json");

function ensureCache() {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {}
}
function jsonl(file: string, row: any) {
  try {
    ensureCache();
    fs.appendFileSync(path.join(CACHE_DIR, file), JSON.stringify(row) + "\n");
  } catch {}
}
function nowIso() {
  return new Date().toISOString();
}

// ---------- Routing state (champion/challenger) ----------
function readRouting(): { champion: Choice; shadow?: Choice; lastUpdateTs: number } {
  try {
    return JSON.parse(fs.readFileSync(ROUTING_FILE, "utf8"));
  } catch {
    const def = {
      champion: {
        provider: "openai" as ProviderName,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        key: "openai:gpt-4o-mini",
      },
      shadow: {
        provider: "granite" as ProviderName,
        model: process.env.GRANITE_MODEL || "granite-3.1-mini",
        key: "granite:granite-3.1-mini",
      },
      lastUpdateTs: 0,
    };
    try {
      ensureCache();
      fs.writeFileSync(ROUTING_FILE, JSON.stringify(def, null, 2));
    } catch {}
    return def;
  }
}
function writeRouting(obj: any) {
  try {
    ensureCache();
    fs.writeFileSync(ROUTING_FILE, JSON.stringify(obj, null, 2));
  } catch {}
}

// ---------- Runtime helpers ----------
function requireFetch(): (input: any, init?: any) => Promise<any> {
  const f = (globalThis as any).fetch;
  if (typeof f !== "function")
    throw new Error("fetch_unavailable: Node 18+ (or a fetch polyfill) is required.");
  return f as any;
}

// Safe header reader (accepts mixed-casing, array values)
function readHeader(req: ReqLike | undefined, name: string) {
  const lower = name.toLowerCase();
  const v =
    req?.get?.(name) ??
    (req?.headers?.[lower] as string | string[] | undefined) ??
    (req?.headers?.[name] as string | string[] | undefined);
  return Array.isArray(v) ? v[0] : v || "";
}

function extractJSON(s: string) {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no_json_found");
  return s.slice(start, end + 1);
}

function parseChoiceHeader(h: string): Choice | null {
  if (!h) return null;
  const val = h.trim().toLowerCase();
  if (val === "1" || val === "true") return { provider: "granite" }; // simple on-switch for shadow
  if (val.includes(":")) {
    const [provider, model] = val.split(":");
    if (["openai", "granite", "ollama"].includes(provider)) {
      return { provider: provider as ProviderName, model, key: `${provider}:${model}` };
    }
  }
  if (["openai", "granite", "ollama"].includes(val)) {
    return { provider: val as ProviderName };
  }
  return null;
}

function pickChampion(req?: ReqLike): Choice {
  // 1) Header override always wins
  const hdr =
    readHeader(req, "x-llm-provider") ||
    readHeader(req, "x-llm-champion");
  const parsed = hdr ? parseChoiceHeader(hdr) : null;
  if (parsed) return parsed;

  // 2) Eval config primary (supports string OR object)
  try {
    const p: any = primaryModel?.();
    if (p) {
      // Case A: string like "granite" or "openai:gpt-4o-mini"
      if (typeof p === "string") {
        const cfgChoice = parseChoiceHeader(p);
        if (cfgChoice) return cfgChoice;
      }
      // Case B: object like { provider, model?, key? }
      else if (p.provider) {
        const choice: Choice = {
          provider: (p.provider || "openai") as ProviderName,
        };
        if (p.model) choice.model = String(p.model);
        if (p.key) choice.key = String(p.key);
        return choice;
      }
    }
  } catch {
    // ignore eval config issues; fall through to env/routing
  }

  // 3) Env fallback
  const env = String(process.env.LLM_CHAMPION || "").toLowerCase();
  const envChoice = env ? parseChoiceHeader(env) : null;
  if (envChoice) return envChoice;

  // 4) Routing file default
  const r = readRouting();
  return r.champion;
}

function pickShadow(req?: ReqLike): Choice | null {
  // Explicit header override still wins for shadow
  const hdr = readHeader(req, "x-llm-shadow");
  const parsed = hdr ? parseChoiceHeader(hdr) : null;
  if (parsed) return parsed;

  // Eval config challenger (gated by shouldRunChallenger)
  try {
    const c: any = challengerModel?.();
    if (c && shouldRunChallenger?.()) {
      const choice: Choice = {
        provider: (c.provider || "granite") as ProviderName,
      };
      if (c.model) choice.model = String(c.model);
      if (c.key) choice.key = String(c.key);
      return choice;
    }
  } catch {
    // ignore eval config issues; treat as "no challenger"
  }

  // If eval mode is off or not configured, no challenger by default.
  return null;
}

// ---------- Providers ----------
async function callOpenAI(args: ChatArgs, modelHint?: string): Promise<ChatRaw> {
  const f = requireFetch();
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) throw new Error("openai_missing_key");
  const model =
    modelHint ||
    (args.tags?.model_hint as string) ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";

  const payload = {
    model,
    temperature: args.temperature ?? 0,
    max_tokens: args.max_tokens ?? 600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: args.system },
      {
        role: "user",
        content:
          (args.schema
            ? `Return ONLY valid JSON for this schema:\n${JSON.stringify(args.schema)}\n---\n`
            : "Return ONLY valid JSON, no prose.\n---\n") + args.user,
      },
    ],
  };

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), args.timeoutMs ?? 20000);
  try {
    const r = await f("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "ybuilt/llm-registry",
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || `openai_http_${(r as any).status}`);
    const data = JSON.parse(txt);
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    return { raw: typeof content === "string" ? content : JSON.stringify(content) };
  } finally {
    clearTimeout(to);
  }
}

// Generic Granite gateway; configure via env. If missing, throw and let caller degrade.
async function callGranite(args: ChatArgs, modelHint?: string): Promise<ChatRaw> {
  const f = requireFetch();
  const url = process.env.GRANITE_API_URL || ""; // e.g., https://granite.example/v1/chat
  const key = process.env.GRANITE_API_KEY || "";
  if (!url || !key) throw new Error("granite_unavailable");

  const model = modelHint || process.env.GRANITE_MODEL || "granite-3.1-mini";
  const payload = {
    model,
    temperature: args.temperature ?? 0,
    max_tokens: args.max_tokens ?? 600,
    json: true,
    messages: [
      { role: "system", content: args.system + "\n(Reply with JSON only.)" },
      { role: "user", content: args.user },
    ],
  };

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), args.timeoutMs ?? 20000);
  try {
    const r = await f(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "User-Agent": "ybuilt/llm-registry",
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || `granite_http_${(r as any).status}`);
    try {
      const j = JSON.parse(txt);
      const content = j?.choices?.[0]?.message?.content ?? j?.message?.content ?? j;
      if (typeof content === "string") return { raw: content };
      return { raw: JSON.stringify(content) };
    } catch {
      // If endpoint already returns direct JSON, pass-through
      return { raw: txt };
    }
  } finally {
    clearTimeout(to);
  }
}

async function callOllama(args: ChatArgs, modelHint?: string): Promise<ChatRaw> {
  const f = requireFetch();
  const base = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = modelHint || process.env.OLLAMA_MODEL || "llama3:8b";
  const payload = {
    model,
    stream: false,
    options: { temperature: args.temperature ?? 0 },
    messages: [
      { role: "system", content: args.system + "\nReturn ONLY JSON, no prose." },
      { role: "user", content: args.user },
    ],
  };

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), args.timeoutMs ?? 20000);
  try {
    const r = await f(`${base}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ybuilt/llm-registry",
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || `ollama_http_${(r as any).status}`);
    try {
      const j = JSON.parse(txt);
      const content =
        j?.message?.content ??
        j?.choices?.[0]?.message?.content ??
        "{}";
      if (typeof content === "string") return { raw: content };
      return { raw: JSON.stringify(content) };
    } catch {
      // Last resort: brace scrape
      try {
        return { raw: extractJSON(txt) };
      } catch {
        return { raw: "{}" };
      }
    }
  } finally {
    clearTimeout(to);
  }
}

// ---------- Provider map + runner ----------
const PROVIDERS: Record<ProviderName, ProviderCall> = {
  openai: callOpenAI,
  granite: callGranite,
  ollama: callOllama,
};

async function runProvider(
  choice: Choice,
  args: ChatArgs
): Promise<{ raw: string; provider: ProviderName }> {
  const name = (choice.provider || "openai") as ProviderName;
  const model = choice.model;
  const fn = PROVIDERS[name] || PROVIDERS.openai;
  try {
    const out = await fn(args, model);
    return { raw: out.raw, provider: name };
  } catch (e: any) {
    // Safe degradations:
    // - Granite missing/errored -> try OpenAI
    // - Ollama missing/errored  -> try OpenAI
    if (name !== "openai") {
      try {
        const fallback = await PROVIDERS.openai(args, undefined);
        return { raw: fallback.raw, provider: "openai" };
      } catch {
        // last ditch
        return { raw: "{}", provider: "openai" };
      }
    }
    return { raw: "{}", provider: "openai" };
  }
}

// ---------- Cache helpers ----------
function norm(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function canonicalKey(args: ChatArgs, choice: { provider: string; model?: string }) {
  return JSON.stringify({
    t: args.task || "",
    sys: norm(args.system || ""),
    usr: norm(args.user || "").slice(0, 4000),
    p: choice.provider,
    m: choice.model || "",
    temp: args.temperature ?? 0,
    max: args.max_tokens ?? 600,
  });
}

// ---------- Public API ----------
export async function chatJSON(
  args: ChatArgs
): Promise<{
  json: any;
  raw: string;
  provider: string;
  shadow?: { provider: string; scheduled: boolean; ok?: boolean };
}> {
  // Champion selection is centralized in pickChampion
  const champion = pickChampion(args.req);

  // --- Provider envelope policy: clamp tokens / allow or block call ---
  const providerName = champion.provider || "openai";

  const requestedMaxTokens =
    typeof args.max_tokens === "number" && Number.isFinite(args.max_tokens)
      ? args.max_tokens
      : 4096;

  // Optional hint from headers/tags; otherwise treat as generic "compose".
  const routeHintFromHeader =
    readHeader(args.req, "x-llm-route") || readHeader(args.req, "x-route");

  const routeHintFromTags =
    (args.tags &&
      typeof (args.tags as any).route === "string" &&
      (args.tags as any).route) ||
    (args.tags &&
      typeof (args.tags as any).path === "string" &&
      (args.tags as any).path);

  const route = routeHintFromTags || routeHintFromHeader || "compose";

  const policyDecision = decideProviderEnvelope({
    providerName,
    route,
    requestedMaxTokens,
    // For now: assume no known PII, JSON response, citations allowed.
    containsPII: false,
    responseHasCitations: true,
    responseIsJson: true,
  });

  if (policyDecision.mode === "block") {
    throw new Error(
      `LLM provider policy blocked call: ${policyDecision.reason ?? "unknown_reason"}`
    );
  }

  const finalMaxTokens =
    typeof policyDecision.maxTokens === "number" &&
    Number.isFinite(policyDecision.maxTokens)
      ? policyDecision.maxTokens
      : requestedMaxTokens;

  const effectiveArgs: ChatArgs = {
    ...args,
    max_tokens: finalMaxTokens,
  };

  // ---- CACHE: deterministic prompt+model key
  const ck = canonicalKey(effectiveArgs, {
    provider: champion.provider,
    model: champion.model,
  });
  if (!effectiveArgs.tags?.no_cache) {
    const hit = getJSON<{ json: any; raw: string; provider: string }>(ck);
    if (hit) {
      // light log (optional): cached source
      jsonl("llm.runs.jsonl", {
        at: nowIso(),
        task: effectiveArgs.task || "",
        provider: hit.provider || "cache",
        ms: 0,
        ok: true,
        model_hint: effectiveArgs.tags?.model_hint || null,
        source: "cache",
      });
      return hit;
    }
  }
  // ---- END CACHE CHECK

  const started = Date.now();

  // Champion run (source of truth; always the primary model)
  const main = await runProvider(champion, effectiveArgs);
  let raw = main.raw;
  let provider = main.provider;
  let ok = raw !== "{}";

  // Parse with brace fallback
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      parsed = JSON.parse(extractJSON(raw));
    } catch {
      parsed = {};
    }
  }

  // Fire-and-forget shadow (optional + safe)
  let shadowMeta:
    | { provider: string; scheduled: boolean; ok?: boolean }
    | undefined = undefined;

  // Explicit shadow override (header) + eval gating live in pickShadow
  let shadowChoice: Choice | null = pickShadow(effectiveArgs.req);

  if (
    shadowChoice &&
    (shadowChoice.provider !== (champion.provider || "openai") || !!shadowChoice.model)
  ) {
    shadowMeta = { provider: shadowChoice.provider, scheduled: true };
    (async () => {
      const t0 = Date.now();
      try {
        const s = await runProvider(shadowChoice!, effectiveArgs);
        // lightweight metric counters without leaking prompts/copy
        try {
          const P = path.join(CACHE_DIR, "shadow.metrics.json");
          const cur = fs.existsSync(P)
            ? JSON.parse(fs.readFileSync(P, "utf8"))
            : { calls: 0, lastTs: 0 };
          cur.calls += 1;
          cur.lastTs = Date.now();
          ensureCache();
          fs.writeFileSync(P, JSON.stringify(cur, null, 2));
        } catch {}
        jsonl("llm.shadow.jsonl", {
          at: nowIso(),
          task: effectiveArgs.task || "",
          champion: champion.provider || "openai",
          shadow: shadowChoice!.provider,
          ms: Date.now() - t0,
          ok: s.raw !== "{}",
          shadow_len: (s.raw || "").length,
        });
      } catch {
        jsonl("llm.shadow.jsonl", {
          at: nowIso(),
          task: effectiveArgs.task || "",
          champion: champion.provider || "openai",
          shadow: shadowChoice!.provider,
          ms: Date.now() - t0,
          ok: false,
        });
      }
    })();
  }

  // Log champion run (privacy-aware)
  jsonl("llm.runs.jsonl", {
    at: nowIso(),
    task: effectiveArgs.task || "",
    provider,
    ms: Date.now() - started,
    ok,
    model_hint: effectiveArgs.tags?.model_hint || null,
  });

  // Write to cache (skip if disabled)
  if (!effectiveArgs.tags?.no_cache) {
    try {
      setJSON(ck, { json: parsed, raw, provider });
    } catch {}
  }

  return { json: parsed, raw, provider, shadow: shadowMeta };
}

// Nightly weight refresh — safe no-op if no metrics present.
export function maybeNightlyRoutingUpdate() {
  const now = Date.now();
  const r = readRouting();
  // 20h+ cadence to avoid tight loops
  if (now - (r.lastUpdateTs || 0) < 20 * 3600 * 1000) return;

  try {
    const P = path.join(CACHE_DIR, "shadow.metrics.json");
    const hasGranite = !!process.env.GRANITE_API_KEY && !!process.env.GRANITE_API_URL;
    const shadowCalls = fs.existsSync(P)
      ? (JSON.parse(fs.readFileSync(P, "utf8")).calls || 0)
      : 0;

    if (hasGranite && shadowCalls >= 50) {
      // Promote shadow to champion (swap)
      const next = { champion: r.shadow || r.champion, shadow: r.champion, lastUpdateTs: now };
      writeRouting(next);
      return;
    }

    // otherwise, just refresh timestamp
    writeRouting({ ...r, lastUpdateTs: now });
  } catch {
    writeRouting({ ...r, lastUpdateTs: now });
  }
}

export default { chatJSON, maybeNightlyRoutingUpdate };

// --- Nightly routing heartbeat: promotes challenger when metrics justify it ---
try {
  // run once at boot, then hourly
  maybeNightlyRoutingUpdate();
  setInterval(maybeNightlyRoutingUpdate, 60 * 60 * 1000);
} catch {}
