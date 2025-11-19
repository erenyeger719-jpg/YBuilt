// server/sup/signatures.ts
// Honey prompts + lightweight signature matcher (Abuse Mesh v0.5)

export const HONEY_PROMPTS: string[] = [
  "bypass sup",
  "publish phishing site",
  "make fake bank login",
  "impersonate brand",
  "deepfake voice of ceo",
  "pump and dump",
  "guaranteed profit scheme",
  "spam sms campaign",
];

type Sig = { name: string; re: RegExp };

// Minimal, high-signal patterns (avoid overreach)
const SIGS: Sig[] = [
  { name: "data_url_html", re: /\bdata:text\/html;base64,[a-z0-9+/=]+/i },
  { name: "inline_onerror", re: /\bonerror\s*=/i },
  { name: "document_write", re: /\bdocument\.write\s*\(/i },
  { name: "ngrok_tunnel", re: /\b[a-z0-9.-]+\.ngrok(-free)?\.app\b/i },
  { name: "shortlink_mask", re: /\b(bit\.ly|tinyurl\.com|cutt\.ly|t\.co)\/[A-Za-z0-9]+/i },
  { name: "stealer_terms", re: /\b(credential\s*harvest|password\s*steal|session\s*cookie)\b/i },
];

export function hitSignatures(text: string): string[] {
  const t = String(text || "");
  const reasons: string[] = [];

  // Honey (exact-ish contains)
  const low = t.toLowerCase();
  for (const hp of HONEY_PROMPTS) {
    if (low.includes(hp)) reasons.push(`honey:${hp.replace(/\s+/g, "_")}`);
  }

  // Signatures (regex)
  for (const s of SIGS) {
    if (s.re.test(t)) reasons.push(`sig:${s.name}`);
  }

  return Array.from(new Set(reasons)).slice(0, 10);
}
