// server/intent/copy.ts
type Intent = {
  audience: string; goal: string; industry: string; vibe: string;
  color_scheme: string; density: string; complexity: string; sections: string[];
};

export function guessBrand(intent: Intent) {
  // vibe/industry → primary color
  if (intent.color_scheme === 'dark') return '#7c3aed';
  if (intent.vibe === 'minimal') return '#111827';
  if (intent.vibe === 'bold') return '#ef4444';
  if (intent.industry === 'ecommerce') return '#0ea5e9';
  if (intent.industry === 'health') return '#10b981';
  return '#6d28d9';
}

export function cheapCopy(prompt: string, intent: Intent) {
  const goal = intent.goal || 'signup';
  const heroTitle =
    intent.industry === 'saas' ? 'Build faster. Ship calmer.' :
    intent.industry === 'ecommerce' ? 'Show what you sell. Convert more.' :
    intent.industry === 'portfolio' ? 'Work that speaks for itself.' :
    'Make the thing people want.';

  const heroSub =
    intent.audience === 'developers'
      ? 'Instant sections, live preview, and sane defaults for devs.'
      : intent.audience === 'founders'
      ? 'From idea to link in minutes—skip the fuss.'
      : 'Clean blocks, real-time preview, zero drama.';

  const cta =
    goal === 'waitlist' ? 'Join the waitlist' :
    goal === 'demo' ? 'Book a demo' :
    goal === 'purchase' ? 'Buy now' :
    goal === 'contact' ? 'Contact us' :
    'Get started';

  const f = [
    ['Fast', 'Idea → live URL in minutes.'],
    ['Safe', 'Sandboxed runs with strict limits.'],
    ['Visible', 'Unified logs and live events.'],
  ];

  return {
    HERO_TITLE: heroTitle,
    HERO_SUB: heroSub,
    CTA_LABEL: cta,
    CTA_HEAD: goal === 'waitlist' ? 'Be first in line' : 'Ready when you are',
    F1_TITLE: f[0][0], F1_BODY: f[0][1],
    F2_TITLE: f[1][0], F2_BODY: f[1][1],
    F3_TITLE: f[2][0], F3_BODY: f[2][1],
  };
}
