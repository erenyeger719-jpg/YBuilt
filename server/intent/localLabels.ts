// server/intent/localLabels.ts
const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.LOCAL_LLM || 'phi3:mini'; // or "qwen2:1.5b-instruct"

type Intent = {
  audience?: string;
  goal?: 'waitlist'|'demo'|'purchase'|'contact'|'';
  industry?: 'saas'|'ecommerce'|'portfolio'|'';
  vibe?: 'minimal'|'playful'|'serious'|'';
  color_scheme?: 'dark'|'light'|'';
  sections?: string[];
};

function extractJSON(s: string) {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

async function withTimeout<T>(p: Promise<T>, ms = 2500): Promise<T> {
  return await Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)) as any,
  ]);
}

export async function localLabels(prompt = ''): Promise<{ intent: Intent; confidence: number }|null> {
  // Ollama /api/generate (non-stream)
  const body = {
    model: MODEL,
    prompt: `
Return ONLY JSON with keys:
{"audience":"","goal":"","industry":"","vibe":"","color_scheme":"","sections":["hero-basic","cta-simple"]}

Rules:
- sections must be from: hero-basic, cta-simple, features-3col.
- goal one of: waitlist, demo, purchase, contact.
- vibe one of: minimal, playful, serious.
- color_scheme: "dark" or "light".

PROMPT: ${prompt}
`.trim(),
    stream: false,
  };

  try {
    const r = await withTimeout(
      fetch(`${OLLAMA}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      2500
    );
    if (!r.ok) return null;
    const data: any = await r.json();
    const parsed = extractJSON(String(data?.response || ''));
    if (!parsed) return null;

    const intent: Intent = {
      audience: String(parsed.audience || ''),
      goal: String(parsed.goal || ''),
      industry: String(parsed.industry || ''),
      vibe: String(parsed.vibe || ''),
      color_scheme: String(parsed.color_scheme || ''),
      sections: Array.isArray(parsed.sections) && parsed.sections.length ? parsed.sections : ['hero-basic','cta-simple'],
    };
    return { intent, confidence: 0.75 };
  } catch {
    return null; // gracefully fall back to rules
  }
}
