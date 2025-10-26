// v0: static mapping; can add embeddings later
const CATALOG = [
  { id: 'hero-basic', kind: 'hero', tags: ['hero','headline','landing'] },
  { id: 'features-3col', kind: 'features', tags: ['features','grid','cards'] },
  { id: 'cta-simple', kind: 'cta', tags: ['cta','signup','button'] },
];

export function needSections(spec: any): string[] {
  const want = new Set<string>(spec?.layout?.sections || []);
  const have = new Set<string>(); // planner could fill later
  const missing: string[] = [];
  want.forEach(id => { if (!have.has(id)) missing.push(id); });
  return missing;
}

export function pickSections(spec: any, missing: string[]): string[] {
  // For now, return the same ids (they’re our known bricks)
  if (!missing?.length) return spec?.layout?.sections || ['hero-basic','features-3col','cta-simple'];
  return missing;
}

export function defaultThree(): string[] {
  return ['hero-basic','features-3col','cta-simple'];
}
