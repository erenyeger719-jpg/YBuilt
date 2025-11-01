// server/llm/registry.ts
// Minimal provider registry with champion/challenger selection + shadow runs.
// Supports: openai (default), granite (stub), ollama (local). JSON-only output.

import fs from "fs";
import path from "path";
import crypto from "crypto";

type ReqLike = { get?: (h: string) => string | undefined; headers?: Record<string, string | string[]> };

type ChatArgs = {
  task?: string;                 // e.g., "filter", "planner", "critic"
  system: string;
  user: string;
  schema?: any;                  // optional JSON Schema (hint)
  temperature?: number;          // default 0
  max_tokens?: number;           // soft cap per provider
  timeoutMs?: number;            // default 20000
  tags?: Record<string, any>;    // metadata (model_hint, cost tags, etc.)
  req?: ReqLike;                 // to read headers for overrides
};

type ChatRaw = { raw: string };
type ProviderCall = (args: ChatArgs) => Promise<ChatRaw>;

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

function requireFetch(): (input: any, init?: any) => Promise<any> {
  const f = (globalThis as any).fetch;
  if (typeof f !== "function") {
    throw new Error("fetch_unavailable: Node 18+ (or a fetch polyfill) is required.");
  }
  return f as any;
}

function extractJSON(s: string) {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no_json_found");
  return s.slice(start, end + 1);
}

function pickChampion(req?: ReqLike) {
  const hdr = (req?.get?.("x-llm-provider") || req?.headers?.["x-llm-provider"] || "") as string;
  const env = String(process.env.LLM_CHAMPION || "").toLowerCase() || "openai";
  const pick = (hdr || env).toLowerCase();
  return ["openai", "granite", "ollama"].includes(pick) ? pick : "openai";
}
function pickChallenger() {
  const env = String(process.env.LLM_CHALLENGER || "").toLowerCase();
  return ["openai", "granite", "ollama"].includes(env) ? env : "";
}
function shadowOn(req?: ReqLike) {
  const hdr = String(req?.get?.("x-llm-shadow") || req?.headers?.["x-llm-shadow"] || "");
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
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || `openai_http_${(r as any).status}`);
    const data = JSON.parse(txt);
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    return { raw: content };
  } finally { clearTimeout(to); }
}

async function callGranite(args: ChatArgs): Promise<ChatRaw> {
  // Stub: generic JSON chat endpoint; adapt to your Granite gateway.
  const f = requireFetch();
  const url = process.env.GRANITE_API_URL || "";   // e.g., https://granite.yourhost/v1/chat
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
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || `granite_http_${(r as any).status}`);
    // Assume Granite returns {choices:[{message:{content:"{...}"}}]}
    try {
      const j = JSON.parse(txt);
      const content = j?.choices?.[0]?.message?.content ?? "{}";
      return { raw: typeof content === "string" ? content : JSON.stringify(content) };
    } catch {
      // or direct JSON body already
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || `ollama_http_${(r as any).status}`);
    // Ollama returns {message:{content:"..."}}
    try {
      const j = JSON.parse(txt);
      const content = j?.message?.content ?? "{}";
      return { raw: typeof content === "string" ? content : JSON.stringify(content) };
    } catch { return { raw: txt }; }
  } finally { clearTimeout(to); }
}

function getCaller(name: string): ProviderCall {
  if (name === "granite") return callGranite;
  if (name === "ollama") return callOllama;
  return callOpenAI; // default
}

function stableStringify(o: any): string {
  if (Array.isArray(o)) return "[" + o.map(stableStringify).join(",") + "]";
  if (o && typeof o === "object") {
    return (
      "{" +
      Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",") +
      "}"
    );
  }
  return JSON.stringify(o);
}

export async function chatJSON(args: ChatArgs): Promise<{ json: any; provider: string; raw: string; shadow?: { provider: string; raw?: string; error?: string } }> {
  const champion = pickChampion(args.req);
  const challenger = pickChallenger();
  const doShadow = shadowOn(args.req) && challenger && challenger !== champion;

  const meta = {
    at: nowIso(),
    task: args.task || "generic",
    champion,
    challenger: doShadow ? challenger : null,
    temperature: args.temperature ?? 0,
    max_tokens: args.max_tokens ?? null,
    tags: args.tags || {},
  };

  // Caching hook (optional)
  const key = crypto.createHash("sha1").update(
    stableStringify({
      p: args.system,
      u: args.user,
      m: { champion, challenger: doShadow ? challenger : "" },
      t: args.temperature ?? 0,
      k: args.max_tokens ?? 0,
    })
  ).digest("hex");

  // Champion call
  const callChampion = getCaller(champion)(args);

  // Shadow call (best-effort, never throws upstream)
  let shadowOut: { provider: string; raw?: string; error?: string } | undefined;
  if (doShadow) {
    getCaller(challenger)(args)
      .then(({ raw }) => {
        shadowOut = { provider: challenger, raw };
        jsonl("llm.shadow.jsonl", { ...meta, key, mode: "shadow", ok: true, provider: challenger });
      })
      .catch((e) => {
        shadowOut = { provider: challenger, error: String(e?.message || e || "shadow_failed") };
        jsonl("llm.shadow.jsonl", { ...meta, key, mode: "shadow", ok: false, provider: challenger, error: shadowOut.error });
      });
  }

  const main = await callChampion;
  let parsed: any;
  try { parsed = JSON.parse(main.raw); }
  catch { parsed = JSON.parse(extractJSON(main.raw)); }

  jsonl("llm.calls.jsonl", { ...meta, key, mode: "champion", provider: champion });

  return { json: parsed, provider: champion, raw: main.raw, shadow: shadowOut };
}
