export type WorkingSpec = {
  id: string;
  summary: string;
  brand?: { tone?: 'playful' | 'serious' | 'minimal'; dark?: boolean };
  layout?: { sections: string[] };
  confidence: number;   // 0..1
  budget_used: number;  // points
};

function pickTone(s: string): WorkingSpec['brand']['tone'] {
  const x = s.toLowerCase();
  if (x.includes('playful') || x.includes('fun')) return 'playful';
  if (x.includes('minimal') || x.includes('clean')) return 'minimal';
  return 'serious';
}

function wantDark(s: string): boolean {
  const x = s.toLowerCase();
  return /dark|black|night|neon/.test(x);
}

function wantSections(s: string): string[] {
  const x = s.toLowerCase();
  const out = new Set<string>();
  if (/hero|headline|above the fold|landing/.test(x)) out.add('hero-basic');
  if (/feature|grid|cards|benefit/.test(x)) out.add('features-3col');
  if (/cta|signup|button|lead/.test(x)) out.add('cta-simple');
  // defaults when empty:
  if (out.size === 0) ['hero-basic', 'features-3col', 'cta-simple'].forEach(v => out.add(v));
  return Array.from(out);
}

export function buildSpec(input: { prompt?: string; lastSpec?: Partial<WorkingSpec> }){
  const p = (input.prompt || '').trim();
  const prev = input.lastSpec || {};
  const tone = prev.brand?.tone || pickTone(p);
  const dark = typeof prev.brand?.dark === 'boolean' ? prev.brand!.dark : wantDark(p);
  const sections = prev.layout?.sections?.length ? prev.layout!.sections : wantSections(p);

  const chips = [
    dark ? 'Switch to light' : 'Use dark mode',
    tone === 'minimal' ? 'More playful' : 'More minimal',
    sections.includes('features-3col') ? 'Use 2-column features' : 'Add 3-card features'
  ];

  const spec: WorkingSpec = {
    id: prev.id || `spec_${Date.now().toString(36)}`,
    summary: p || prev.summary || 'Basic landing page',
    brand: { tone, dark },
    layout: { sections },
    confidence: Math.min(1, 0.4 + (p ? 0.2 : 0) + (prev.confidence || 0)),
    budget_used: prev.budget_used ?? 0
  };

  return { spec, chips };
}
