// server/intent/filter.ts
type Intent = {
  audience: 'founders'|'developers'|'designers'|'marketers'|'consumers'|'general';
  goal: 'signup'|'waitlist'|'purchase'|'demo'|'contact'|'info';
  industry: 'saas'|'ecommerce'|'portfolio'|'ai'|'crypto'|'health'|'edu'|'other';
  vibe: 'minimal'|'playful'|'serious'|'bold'|'elegant';
  color_scheme: 'dark'|'light'|'brand';
  density: 'minimal'|'standard'|'rich';
  complexity: 'simple'|'medium'|'advanced';
  sections: string[]; // maps to your bricks
};

function pick<T extends string>(pairs: Array<[RegExp,T]>, s: string, d: T): T {
  for (const [re, v] of pairs) if (re.test(s)) return v; return d;
}
function has(re: RegExp, s: string) { return re.test(s); }

export async function filterIntent(prompt: string): Promise<{
  intent: Intent; confidence: number; chips: string[];
}> {
  const p = String(prompt || '').toLowerCase();

  // --- audience ---
  const audience = pick(
    [
      [/\bdev(s|elopers)?\b|api|sdk|cli/, 'developers'],
      [/\b(founder|startup|b2b)\b/, 'founders'],
      [/\bdesigner(s)?\b|figma|dribbble/, 'designers'],
      [/\bmarketer(s)?\b|campaign|ad|seo|crm/, 'marketers'],
      [/\bshopper|customer|consumer|store/, 'consumers'],
    ],
    p, 'general'
  );

  // --- goal ---
  const goal = pick(
    [
      [/\b(waitlist|notify|early access)\b/, 'waitlist'],
      [/\b(sign ?up|join|create account|register)\b/, 'signup'],
      [/\b(buy|checkout|cart|price|pricing|purchase)\b/, 'purchase'],
      [/\b(book|demo|schedule|meeting)\b/, 'demo'],
      [/\b(contact|reach|email us)\b/, 'contact'],
      [/\binfo|overview|about/, 'info'],
    ],
    p, 'signup'
  );

  // --- industry ---
  const industry = pick(
    [
      [/\bsaas|b2b|dashboard|subscription/, 'saas'],
      [/\bshop|store|e-?com(merce)?|cart|product/, 'ecommerce'],
      [/\bportfolio|photograph|resume|cv|case study/, 'portfolio'],
      [/\b(ai|model|llm|prompt|genai)\b/, 'ai'],
      [/\bcrypto|token|defi|wallet|web3/, 'crypto'],
      [/\bhealth|med|clinic|fit(ness)?|wellness/, 'health'],
      [/\bedu|course|learn|student|teacher|lms/, 'edu'],
    ],
    p, 'other'
  );

  // --- vibe + density ---
  const vibe = pick(
    [
      [/\bminimal|clean|simple|sleek|airy/, 'minimal'],
      [/\bplayful|fun|whimsical|quirky/, 'playful'],
      [/\bserious|formal|enterprise|professional/, 'serious'],
      [/\bbold|loud|impact|punchy/, 'bold'],
      [/\belegant|lux|premium|refined/, 'elegant'],
    ],
    p, 'serious'
  );
  const density: Intent['density'] = has(/\bminimal|simple|single(-|\s)?page\b/, p)
    ? 'minimal' : has(/\brich|heavy|long|content\b/, p) ? 'rich' : 'standard';

  // --- color scheme ---
  const color_scheme: Intent['color_scheme'] =
    has(/\bdark|black|night|neon/, p) ? 'dark' :
    has(/\blight|white|bright/, p) ? 'light' : 'brand';

  // --- complexity ---
  const complexity: Intent['complexity'] =
    has(/\bdashboard|docs|pricing|blog|auth|admin|multi(-|\s)?page\b/, p) ? 'advanced' :
    has(/\bpricing|faq|features|contact\b/, p) ? 'medium' : 'simple';

  // --- sections (map to your bricks) ---
  const sections = (() => {
    const out = new Set<string>();
    if (has(/\b(hero|headline|above the fold|landing)\b/, p)) out.add('hero-basic');
    if (has(/\b(feature|grid|card|benefit|value)\b/, p)) out.add('features-3col');
    if (has(/\b(cta|signup|button|lead|waitlist|join)\b/, p)) out.add('cta-simple');
    if (out.size === 0) ['hero-basic','features-3col','cta-simple'].forEach(v => out.add(v));
    return Array.from(out);
  })();

  // --- confidence (cheap calibration) ---
  const hits =
    (audience !== 'general' ? 1 : 0) +
    (goal !== 'signup' ? 1 : 0) +
    (industry !== 'other' ? 1 : 0) +
    (vibe !== 'serious' ? 1 : 0) +
    (color_scheme !== 'brand' ? 1 : 0) +
    (complexity !== 'simple' ? 1 : 0);
  let confidence = Math.min(0.95, 0.4 + 0.08 * hits); // 0.4..0.95

  // --- chips (micro-clarifiers) ---
  const chips = [
    color_scheme === 'dark' ? 'Switch to light' : 'Use dark mode',
    density === 'minimal' ? 'More content' : 'Keep it minimal',
    goal === 'signup' ? 'Use waitlist instead' : 'Use email signup CTA',
  ];

  const intent: Intent = {
    audience, goal, industry, vibe, color_scheme, density, complexity, sections
  };

  return { intent, confidence, chips };
}
