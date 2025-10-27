// intent/locales.ts
export const SUPPORTED = ["en","es","fr","de","hi","ar","ja"] as const;
export type Locale = typeof SUPPORTED[number];

export function normalizeLocale(input?: string): Locale {
  const s = String(input || "en").trim().toLowerCase().replace("_","-");
  const base = s.split("-")[0];
  return (SUPPORTED as readonly string[]).includes(base) ? (base as Locale) : "en";
}

export function isRTL(locale?: string): boolean {
  const l = String(locale || "").toLowerCase();
  return /^(ar|he|fa|ur)\b/.test(l);
}

export function isCJK(locale?: string): boolean {
  const l = String(locale || "").toLowerCase();
  return /^(ja|zh|ko)\b/.test(l);
}
