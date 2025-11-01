// server/llm/registry.ts
// Minimal provider registry with champion/challenger + optional shadow runs.
// Supports: openai (default), granite (stub endpoint), ollama (local).
// Returns JSON-only outputs, with brace-scrape fallback if a provider slips prose.

import fs from "fs";
import path from "path";

// ---------- Types ----------
export type ReqLike = {
  get?: (h: string) => string | undefined;
  headers?: Record<string, string | string[]>;
};

export type ChatArgs = {
  task?: string;               // e.g., "filter", "planner", "critic"
  system: string;
  user: string;
  schema?: any;                // optional JSON Schema (hint)
  temperature?: number;        // default 0
  max_tokens?: number;         // soft cap per provider
  timeoutMs?: number;          // default 20000
  tags?: Record<string, any>;  // metadata (model_hint, cost tags, etc.)
  req?: ReqLike;               // to read headers for overrides
};

type ChatRaw = { raw: string };
type ProviderCall = (args: ChatArgs) => Promise<ChatRaw>;

// ---------- FS utils ----------
const CACHE_DIR = ".cache";
function ensureCache() {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
}
function jsonl(file: string, row: any) {
  try {
    ensureCache();
    fs.appendFileSync(path.join(CACHE_DIR, file), JSON.stringify(row) + "\n");
  } catch {}
}
function nowIso() { return new Date().toISOString(); }

// ---------- Runtime helpers ----------
function requireFetch(): (input: any, init?: any) => Promise<any> {
  const f = (globalThis as any).fetch;
  if (typeof f !== "function") {
    throw new Error("fetch_unavailable: Node 18+ (or a fetch polyfill) is required.");
  }
  return f as any;
}

// Safe header reader (accepts mixed-casing, array values)
function readHeader(req: ReqLike | undefined, name: string) {
  const v =
    req?.get?.(name) ??
    (req?.headers?.[name.toLowerCase()] as string | string[] | undefined) ??
    (req?.headers?.[name] as string | string[] | undefined);
  return Array.isArray(v) ? v[0] : v || "";
}

function extractJSON(s: string) {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no_json_found");
  return s.slice(start, end + 1);
}

function pickChampion(req?: ReqLike) {
  const hdr = readHeader(req, "x-llm-provider");
  const env = String(process.env.LLM_CHAMPION || "").toLowerCase() || "openai";
  const pick = (hdr || env).toLowerCase();
  return ["openai", "granite", "ollama"].includes(pick) ? pick : "openai";
}
function pickChallenger() {
  const env = String(process.env.LLM_CHALLENGER || "").toLowerCase();
  return ["openai", "granite", "ollama"].includes(env) ? env : "";
}
function shadowOn(req?: ReqLike) {
  const hdr = readHeader(req, "x-llm-shadow");
  const env = String(process.env.LLM_SHADOW || "");
  return hdr === "1" || env === "1";
}

// ---------- Providers ----------
async function callOpenAI(args: ChatArgs): Promise<ChatRaw> {
  const f = requireFetch();
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) throw new Error("openai_missing_key");
  const model =
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
  } finally { clearTimeout(to); }
}

async function callGranite(args: ChatArgs): Promise<ChatRaw> {
  // Generic JSON chat endpoint; adapt to your Granite gateway.
  const f = requireFetch();
  const url = process.env.GRANITE_API_URL || "";   // e.g., https://granite.example/v1/chat
  const key = process.env.GRANITE_API_KEY || "";
  if (!url || !key) throw new Error("granite_unavailable");

  const payload = {
    model: process.env.GRANITE_MODEL || "granite-3.1-mini",
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
      // If endpoint already returns direct JSON, just pass it through.
      return { raw: txt };
    }
  } finally { clearTimeout(to); }
}

async function callOllama(args: ChatArgs): Promise<ChatRaw> {
  const f = requireFetch();
  const base = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3:8b";
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

    // Ollama returns {message:{content:"..."}, done: true}
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
      try { return { raw: extractJSON(txt) }; }
      catch { return { raw: "{}" }; }
    }
  } finally { clearTimeout(to); }
}

// ---------- Router ----------
const PROVIDERS: Record<string, ProviderCall> = {
  openai: callOpenAI,
  granite: callGranite,
  ollama: callOllama,
};

async function runProvider(name: string, args: ChatArgs): Promise<ChatRaw> {
  const fn = PROVIDERS[name] || PROVIDERS.openai;
  return fn(args);
}

// ---------- Public API ----------
export async function chatJSON(
  args: ChatArgs
): Promise<{ json: any; raw: string; provider: string; shadow?: { provider: string; scheduled: boolean; ok?: boolean } }> {
  const champion = pickChampion(args.req);
  const challenger = pickChallenger();
  const doShadow = shadowOn(args.req);

  const started = Date.now();
  let raw = "{}";
  let provider = champion;
  let ok = true;

  try {
    const out = await runProvider(champion, args);
    raw = out.raw;
  } catch {
    ok = false;
    raw = "{}";
  }

  // Parse with brace fallback
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    try { parsed = JSON.parse(extractJSON(raw)); }
    catch { parsed = {}; }
  }

  // Fire-and-forget shadow run (report as scheduled; do not claim success yet)
  let shadowMeta: { provider: string; scheduled: boolean; ok?: boolean } | undefined = undefined;
  if ((doShadow || challenger) && (challenger || champion !== "openai")) {
    const shadowProv = challenger || (champion === "openai" ? "granite" : "openai");
    shadowMeta = { provider: shadowProv, scheduled: true };
    (async () => {
      const t0 = Date.now();
      try {
        const s = await runProvider(shadowProv, args);
        jsonl("llm.shadow.jsonl", {
          at: nowIso(),
          task: args.task || "",
          champion,
          shadow: shadowProv,
          ms: Date.now() - t0,
          ok: true,
          // store only hash-length content to avoid leaking prompts/copy
          shadow_len: (s.raw || "").length,
        });
      } catch {
        jsonl("llm.shadow.jsonl", {
          at: nowIso(),
          task: args.task || "",
          champion,
          shadow: shadowProv,
          ms: Date.now() - t0,
          ok: false,
        });
      }
    })();
  }

  // Log champion run (lightweight, privacy-aware)
  jsonl("llm.runs.jsonl", {
    at: nowIso(),
    task: args.task || "",
    provider,
    ms: Date.now() - started,
    ok,
    model_hint: args.tags?.model_hint || null,
  });

  return { json: parsed, raw, provider, shadow: shadowMeta };
}

export default { chatJSON };
