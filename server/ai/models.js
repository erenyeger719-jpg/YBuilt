// server/ai/models.js
import assert from "node:assert/strict";

export const has = {
  openai: !!process.env.OPENAI_API_KEY,
  anthropic: !!process.env.ANTHROPIC_API_KEY,
  google: !!process.env.GOOGLE_API_KEY,
};

// Normalize messages: [{role, content}]
function normMessages(system, messages) {
  const out = [];
  if (system) out.push({ role: "system", content: system });
  return out.concat(messages || []);
}

async function callOpenAI({ model, system, messages, temperature = 0.2, max_tokens = 2000, response_format }) {
  assert(process.env.OPENAI_API_KEY, "OPENAI_API_KEY missing");
  const body = {
    model,
    temperature,
    max_tokens,
    messages: normMessages(system, messages),
  };
  if (response_format) body.response_format = response_format; // e.g. {type:"json_object"}

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`openai ${res.status}: ${msg}`);
  }
  const content = data?.choices?.[0]?.message?.content ?? "";
  return { content, raw: data };
}

// Stubs for later: wire when you add keys.
async function callAnthropic() {
  throw new Error("Anthropic not configured yet");
}
async function callGoogle() {
  throw new Error("Google (Gemini) not configured yet");
}

// Unified entry
export async function callModel({ provider, ...opts }) {
  if (provider === "openai") return callOpenAI(opts);
  if (provider === "anthropic") return callAnthropic(opts);
  if (provider === "google") return callGoogle(opts);
  throw new Error(`unknown provider: ${provider}`);
}
