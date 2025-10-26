// server/intent/dsl.ts
export type SectionId = 'hero-basic'|'features-3col'|'cta-simple';

const REGISTRY: Record<SectionId, { tokens: string[] }> = {
  'hero-basic':     { tokens: ['HERO_TITLE','HERO_SUB','CTA_LABEL'] },
  'features-3col':  { tokens: ['F1_TITLE','F1_BODY','F2_TITLE','F2_BODY','F3_TITLE','F3_BODY'] },
  'cta-simple':     { tokens: ['CTA_HEAD','CTA_LABEL'] },
};

const DEFAULT_SECTIONS: SectionId[] = ['hero-basic','cta-simple'];

function normalizeSections(ids: string[]): SectionId[] {
  const out: SectionId[] = [];
  for (const id of ids || []) if ((REGISTRY as any)[id]) out.push(id as SectionId);
  return out.length ? out : DEFAULT_SECTIONS;
}

function allowedTokens(ids: SectionId[]): Set<string> {
  const s = new Set<string>();
  for (const id of ids) REGISTRY[id].tokens.forEach(t => s.add(t));
  return s;
}

function sanitizeCopy(copy: Record<string, any>, allow: Set<string>) {
  const out: Record<string,string> = {};
  for (const [k, v] of Object.entries(copy || {})) {
    if (!allow.has(k)) continue;
    out[k] = String(v ?? '').slice(0, 300);
  }
  return out;
}

type DSL = { sections: string[]; copy?: Record<string, any>; brand?: { primary?: string } };

const LAST_GOOD: Record<string, DSL> = {};

export function verifyAndPrepare(input: DSL) {
  const sections = normalizeSections(Array.isArray(input?.sections) ? input.sections : []);
  const allow = allowedTokens(sections);
  const copy  = sanitizeCopy(input?.copy || {}, allow);
  const brand = { primary: String(input?.brand?.primary || '') };
  return { sections, copy, brand, allowed: Array.from(allow) };
}

export function rememberLastGood(sessionId: string, dsl: DSL) {
  const s = sessionId || 'anon';
  LAST_GOOD[s] = {
    sections: [...(dsl.sections || [])],
    copy: { ...(dsl.copy || {}) },
    brand: { ...(dsl.brand || {}) },
  };
}
export function lastGoodFor(sessionId: string): DSL | null {
  return LAST_GOOD[sessionId || 'anon'] || null;
}

// --- defaults for allowed tokens in selected sections ---
export function defaultsForSections(ids: SectionId[]) {
  const allowed = allowedTokens(ids);
  const D: Record<string,string> = {
    HERO_TITLE: 'Build faster. Ship calmer.',
    HERO_SUB: 'Clean blocks, real-time preview.',
    CTA_LABEL: 'Get started',
    CTA_HEAD: 'Ready when you are',
    F1_TITLE: 'Fast',    F1_BODY: 'Idea → live URL in minutes.',
    F2_TITLE: 'Safe',    F2_BODY: 'Sandboxed runs with strict limits.',
    F3_TITLE: 'Visible', F3_BODY: 'Unified logs and live events.',
  };
  const out: Record<string,string> = {};
  for (const k of Array.from(allowed)) if (D[k]) out[k] = D[k];
  return out;
}
