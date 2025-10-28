// server/intent/locales.ts
// Minimal, deterministic locale utilities used by the AI router.
// No external deps; "translation" is a safe passthrough until you wire real i18n.

type HeadersLike = Record<string, string | string[] | undefined>;

export const SUPPORTED_LOCALES = [
  "en", "en-IN",
  "hi", "hi-IN",
  "es", "fr", "de",
  "ja", "ko",
  "zh-CN", "zh-TW",
  "ar", "he", "fa", "ur",
] as const;

const RTL_BASE = new Set(["ar", "he", "fa", "ur"]);
const PRIMARY_FALLBACK = "en";

/** "en-IN" -> "en-IN" if supported, else "en" if supported, else "en" */
export function normalizeLocale(input?: string | null): string {
  const raw = String(input || "").trim();
  if (!raw) return PRIMARY_FALLBACK;

  // exact match
  if (SUPPORTED_LOCALES.includes(raw as any)) return raw;

  // try primary subtag
  const primary = raw.split("-")[0];
  if (SUPPORTED_LOCALES.includes(primary as any)) return primary;

  return PRIMARY_FALLBACK;
}

/** Is the locale right-to-left? */
export function isRtl(locale?: string | null): boolean {
  const norm = normalizeLocale(locale);
  const primary = norm.split("-")[0];
  return RTL_BASE.has(primary);
}

/** Parse Accept-Language header into ranked list, return best supported */
export function pickFromAcceptLanguage(acceptLang?: string | null): string {
  const items: Array<{ tag: string; q: number }> = [];
  const src = String(acceptLang || "");
  for (const part of src.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [tag, ...params] = part.split(";").map((s) => s.trim());
    let q = 1;
    for (const p of params) {
      const m = /^q=([0-9.]+)$/.exec(p);
      if (m) q = Math.max(0, Math.min(1, parseFloat(m[1])));
    }
    items.push({ tag, q });
  }
  items.sort((a, b) => b.q - a.q);

  for (const it of items) {
    const norm = normalizeLocale(it.tag);
    if (norm) return norm;
  }
  return PRIMARY_FALLBACK;
}

/** Choose a supported locale from headers & fallbacks */
export function localeFromHeaders(
  headers: HeadersLike,
  fallback?: string
): string {
  const explicit = String(headers["x-locale"] || headers["x-language"] || "").trim();
  if (explicit) return normalizeLocale(explicit);

  const al = (headers["accept-language"] || headers["Accept-Language"] || "") as string;
  if (al) return pickFromAcceptLanguage(al);

  return normalizeLocale(fallback || PRIMARY_FALLBACK);
}

/** Stable no-op translator (placeholder). Returns the same copy today. */
export function translateCopy<T extends Record<string, any>>(
  copy: T,
  locale: string
): T {
  // Deterministic placeholder:
  // - If keys like FOO__hi exist, prefer them when locale primary matches.
  const out: Record<string, any> = { ...copy };
  const primary = normalizeLocale(locale).split("-")[0];

  for (const [k, v] of Object.entries(copy || {})) {
    const keyForPrimary = `${k}__${primary}`;
    const keyForExact = `${k}__${normalizeLocale(locale)}`;
    if (keyForExact in copy) out[k] = copy[keyForExact];
    else if (keyForPrimary in copy) out[k] = copy[keyForPrimary];
    else out[k] = v;
  }
  return out as T;
}

/** Convenience wrapper many routers use */
export function chooseLocale(opts?: { headers?: HeadersLike; fallback?: string }) {
  const lc = localeFromHeaders(opts?.headers || {}, opts?.fallback);
  return { locale: lc, rtl: isRtl(lc) };
}

export default {
  SUPPORTED_LOCALES,
  normalizeLocale,
  isRtl,
  pickFromAcceptLanguage,
  localeFromHeaders,
  translateCopy,
  chooseLocale,
};
