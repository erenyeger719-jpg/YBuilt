// intent/phrases.ts
import { normalizeLocale, type Locale } from "./locales.ts";

// Minimal deterministic phrases used across sections.
// Extend anytime; unknown keys are left untouched.
const BANK: Record<Locale, Record<string,string>> = {
  en: {
    HEADLINE: "Build once. Ship everywhere.",
    HERO_SUBHEAD: "Fast, accessible pages with zero guesswork.",
    TAGLINE: "Quiet design. Loud results.",
    CTA_LABEL: "Get started",
    CTA_HEAD: "Ready when you are",
  },
  es: {
    HEADLINE: "Crea una vez. Lanza en todas partes.",
    HERO_SUBHEAD: "Páginas rápidas y accesibles, sin adivinanzas.",
    TAGLINE: "Diseño calmado. Resultados claros.",
    CTA_LABEL: "Comenzar",
    CTA_HEAD: "Listos cuando tú",
  },
  fr: {
    HEADLINE: "Construire une fois. Déployer partout.",
    HERO_SUBHEAD: "Pages rapides et accessibles, sans tâtonner.",
    TAGLINE: "Design calme. Résultats nets.",
    CTA_LABEL: "Commencer",
    CTA_HEAD: "Prêt quand vous l’êtes",
  },
  de: {
    HEADLINE: "Einmal bauen. Überall ausliefern.",
    HERO_SUBHEAD: "Schnelle, barrierefreie Seiten ohne Ratespiel.",
    TAGLINE: "Ruhiges Design. Klare Ergebnisse.",
    CTA_LABEL: "Loslegen",
    CTA_HEAD: "Bereit, wenn du es bist",
  },
  hi: {
    HEADLINE: "एक बार बनाएं. हर जगह लॉन्च करें।",
    HERO_SUBHEAD: "तेज़ और सुलभ पेज—बिना अनुमान के।",
    TAGLINE: "शांत डिज़ाइन, साफ़ नतीजे।",
    CTA_LABEL: "शुरू करें",
    CTA_HEAD: "जब आप तैयार",
  },
  ar: {
    HEADLINE: "ابنِ مرة. وانشر في كل مكان.",
    HERO_SUBHEAD: "صفحات سريعة وسهلة الوصول بلا تخمين.",
    TAGLINE: "تصميم هادئ. نتائج واضحة.",
    CTA_LABEL: "ابدأ الآن",
    CTA_HEAD: "جاهزون حين تكون",
  },
  ja: {
    HEADLINE: "一度作れば、どこへでも出せる。",
    HERO_SUBHEAD: "速くてアクセシブル。迷いのないページ。",
    TAGLINE: "静かなデザイン。はっきりした成果。",
    CTA_LABEL: "はじめる",
    CTA_HEAD: "準備ができたら",
  },
};

const PRIORITY_KEYS = ["HEADLINE","HERO_SUBHEAD","TAGLINE","CTA_LABEL","CTA_HEAD"];

export function localizeCopy(copy: Record<string,string>, localeIn?: string) {
  const lc = normalizeLocale(localeIn);
  const bank = BANK[lc] || BANK.en;
  const out = { ...copy };

  for (const k of PRIORITY_KEYS) {
    if (bank[k]) out[k] = bank[k];        // override deterministically
  }
  return out;
}
