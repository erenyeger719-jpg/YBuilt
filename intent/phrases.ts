// server/intent/phrases.ts
import { normalizeLocale } from "./locales.ts";

const BANK = {
  en: {
    "Get started": "Get started",
    "Join the waitlist": "Join the waitlist",
    "Ready when you are": "Ready when you are",
    "Be first in line": "Be first in line",
    "Learn more": "Learn more",
    "Buy now": "Buy now",
    "Contact us": "Contact us",
  },
  hi: {
    "Get started": "शुरू करें",
    "Join the waitlist": "वेटलिस्ट में जुड़ें",
    "Ready when you are": "जब आप तैयार हों",
    "Be first in line": "सबसे पहले बने",
    "Learn more": "और जानें",
    "Buy now": "अभी खरीदें",
    "Contact us": "हमसे संपर्क करें",
  },
  es: {
    "Get started": "Empezar",
    "Join the waitlist": "Únete a la lista",
    "Ready when you are": "Cuando tú digas",
    "Be first in line": "Sé el primero",
    "Learn more": "Saber más",
    "Buy now": "Comprar ahora",
    "Contact us": "Contáctanos",
  },
} as const;

type Copy = Record<string, string>;

export function localizeCopy(copy: Copy, locale: string): Copy {
  const lang = (normalizeLocale(locale) || "en").slice(0, 2) as keyof typeof BANK;
  const dict = BANK[lang] || BANK.en;
  const out: Copy = { ...copy };

  // Translate only known short phrases; everything else stays verbatim.
  for (const k of Object.keys(out)) {
    const v = String(out[k] ?? "");
    if (v in dict) out[k] = dict[v as keyof typeof dict];
  }

  // Sensible defaults if missing
  if (!out.CTA_LABEL) out.CTA_LABEL = dict["Get started"];
  if (!out.CTA_HEAD) out.CTA_HEAD = dict["Ready when you are"];

  return out;
}
