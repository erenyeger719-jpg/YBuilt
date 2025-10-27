// server/intent/citelock.ts
export function sanitizeFacts(copy: Record<string, string> = {}) {
  const flags: string[] = [];
  const patch: Record<string, string> = {};

  const sus = /\b(#1|No\.?\s?1|top|best|leading|largest)\b|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:%|percent|x|k|m|b)\b|\b(since|est\.?)\s*20\d{2}\b/i;
  const hasSource = (s: string) => /\bhttps?:\/\/|source:|ref:|footnote|data:/i.test(s);

  for (const [k, v] of Object.entries(copy)) {
    if (typeof v !== "string") continue;
    if (sus.test(v) && !hasSource(v)) {
      flags.push(k);
      const nv = v
        .replace(/\b(#1|No\.?\s?1|top|best|leading|largest)\b/gi, "trusted")
        .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(%|percent)\b/gi, "many")
        .replace(/\b\d+(?:\.\d+)?\s*x\b/gi, "multi-fold")
        .replace(/\b(since|est\.?)\s*20\d{2}\b/gi, "for years");
      patch[k] = nv;
    }
  }
  return { copyPatch: patch, flags };
}
