// server/intent/phrases.ts
import { normalizeLocale } from "./locales.ts";

/* ---------------------------
   A) Original vibe-based bank
----------------------------*/
type IntentLite = {
  goal?: "waitlist" | "demo" | "purchase" | "contact";
  vibe?: "minimal" | "playful" | "serious";
  industry?: "saas" | "ecommerce" | "portfolio";
};

const BANK: Record<string, Record<string, string[]>> = {
  HERO_TITLE: {
    minimal: [
      "Build faster. Ship calmer.",
      "The clean way to launch.",
      "Minimal stack. Maximum signal.",
      "Smaller surface, stronger outcomes.",
      "Fewer knobs. Better defaults.",
      "Clarity beats cleverness.",
    ],
    playful: [
      "Press go. Get wow.",
      "Tiny app, big vibes.",
      "Click, boom, shipped.",
      "Snack-size setup, full-course shine.",
      "Tap tap—ta-da.",
      "Make it cute, keep it quick.",
    ],
    serious: [
      "Operational clarity for modern teams",
      "Ship reliable software, predictably",
      "From idea to impact—without the noise",
      "Outcomes over ornament",
      "Production discipline, startup speed",
      "Less surface area, fewer incidents",
    ],
  },
  HERO_SUB: {
    minimal: [
      "Opinionated defaults for landing pages and simple flows.",
      "No sprawl—sections, slots, and instant previews.",
      "Choose sections, tweak copy, publish with confidence.",
      "Tight system, clean UI, measurable wins.",
      "Everything you need, nothing to babysit.",
      "Designed to remove decisions, not control.",
    ],
    playful: [
      "Pick some blocks, sprinkle copy, done. Free refills.",
      "Your site’s glow-up, minus the homework.",
      "Drag a vibe, press ship, look smart.",
      "Small moves, big sparkle.",
      "You handle the flavor—we’ll plate it.",
      "Clicks not chores.",
    ],
    serious: [
      "Composable sections, strong a11y, and reviewable diffs.",
      "Craft high-quality pages with measurable outcomes.",
      "Deterministic changes, low risk, clear reviews.",
      "Standards-first UX with verifiable quality.",
      "Fewer regressions, faster approvals.",
      "Guardrails that scale.",
    ],
  },
  CTA_LABEL: {
    minimal: [
      "Join the waitlist",
      "Get started",
      "Try the demo",
      "Preview now",
      "Continue",
      "Go minimal",
    ],
    playful: ["Let’s go", "I’m in", "Make one for me", "Spin it up", "Surprise me", "Do the thing"],
    serious: ["Start now", "Request access", "Book a demo", "Begin trial", "Evaluate now", "See it working"],
  },
  CTA_HEAD: {
    minimal: ["Ready when you are", "Launch in minutes", "Make one, iterate later", "Setup that respects time"],
    playful: ["We preheated the oven", "Let’s ship something shiny", "Your turn to press go", "Blink and it’s live"],
    serious: [
      "Production-grade from day one",
      "Less risk, more signal",
      "Fewer edits to ship",
      "Quality by default",
    ],
  },
  F1_TITLE: {
    minimal: ["Sections, not spaghetti", "Clean building blocks"],
    playful: ["Pick-a-block magic", "Lego, but for pages"],
    serious: ["Composable building blocks", "Stable primitives"],
  },
  F1_SUB: {
    minimal: ["Hero, features, CTA—clean defaults you can trust.", "Small set, strong choices."],
    playful: ["Drag the vibes into place, we’ll do the grown-up bits.", "Blocks that behave."],
    serious: ["A small library of audited, accessible sections.", "Predictable composition with constraints."],
  },
  F2_TITLE: {
    minimal: ["Copy by tiny slots", "Micro text wins"],
    playful: ["Words, but snack-sized", "Little labels, big lift"],
    serious: ["Structured copy inputs", "Deterministic text slots"],
  },
  F2_SUB: {
    minimal: ["Short labels fill exact slots. No rambling.", "Small edits, instant clarity."],
    playful: ["No essays. Just zingers.", "Punchy bits over paragraphs."],
    serious: ["Deterministic slot text for predictable output.", "Terse inputs, testable results."],
  },
  F3_TITLE: {
    minimal: ["Preview, then publish", "See it as you ship"],
    playful: ["Instant glow-up", "Click. Boom. Pretty."],
    serious: ["Reviewable diffs", "Traceable changes"],
  },
  F3_SUB: {
    minimal: ["Every change shows up in a live preview URL.", "Ship once you can see it."],
    playful: ["Click. Boom. Pretty.", "No mystery meat—just pixels."],
    serious: ["Forked previews with QA checks and shareable links.", "Change control without ceremony."],
  },
};

function vibeKey(v: string | undefined) {
  return v === "playful" || v === "serious" ? v : "minimal";
}

function applyIndustry(text: string, industry?: IntentLite["industry"]) {
  if (!text) return text;
  switch (industry) {
    case "ecommerce":
      return text.replace(/pages?/gi, "product pages").replace(/teams?/gi, "stores").replace(/publish/gi, "go live");
    case "portfolio":
      return text.replace(/pages?/gi, "project pages").replace(/teams?/gi, "clients").replace(/ship/gi, "show");
    case "saas":
      return text.replace(/pages?/gi, "docs & landing pages").replace(/launch/gi, "deploy");
    default:
      return text;
  }
}

export function pickPhrase(slot: keyof typeof BANK, intent: IntentLite = {}) {
  const v = vibeKey(intent.vibe);
  const list = BANK[slot]?.[v] || [];
  if (!list.length) return "";
  const idx = Math.abs(((intent.goal || "waitlist").charCodeAt(0) || 1) % list.length);
  return applyIndustry(list[idx], intent.industry);
}

/* ---------------------------------------------
   B) Deterministic localization for common keys
----------------------------------------------*/
type Copy = Record<string, string>;

const PHRASE_BANK = {
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

// Deterministic defaults for common COPY KEYS per locale.
// Applied only if missing OR still equal to the English default.
const COPY_KEY_BANK = {
  en: {
    HEADLINE: "Build something people want.",
    HERO_SUBHEAD: "Launch fast. Iterate faster.",
    TAGLINE: "Quiet speed by default.",
    CTA_LABEL: "Get started",
    CTA_HEAD: "Ready when you are",
  },
  hi: {
    HEADLINE: "वही बनाएं जो लोग चाहते हैं।",
    HERO_SUBHEAD: "तेजी से लॉन्च करें। और तेज़ सुधारें।",
    TAGLINE: "शांत गति, डिफ़ॉल्ट रूप से।",
    CTA_LABEL: "शुरू करें",
    CTA_HEAD: "जब आप तैयार हों",
  },
  es: {
    HEADLINE: "Crea lo que la gente quiere.",
    HERO_SUBHEAD: "Lanza rápido. Itera más rápido.",
    TAGLINE: "Velocidad tranquila por defecto.",
    CTA_LABEL: "Empezar",
    CTA_HEAD: "Cuando tú digas",
  },
} as const;

function langOf(locale: string) {
  return (normalizeLocale(locale) || "en").slice(0, 2) as keyof typeof PHRASE_BANK & keyof typeof COPY_KEY_BANK;
}

// Translate known short phrases (values) and fill known copy keys deterministically.
export function localizeCopy(copy: Copy, locale: string): Copy {
  const lang = langOf(locale);
  const phraseDict = PHRASE_BANK[lang] || PHRASE_BANK.en;
  const keyDict = COPY_KEY_BANK[lang] || COPY_KEY_BANK.en;
  const keyDictEN = COPY_KEY_BANK.en;

  const out: Copy = { ...copy };

  // 1) Value-level phrase mapping (safe UI bits)
  for (const k of Object.keys(out)) {
    const v = String(out[k] ?? "");
    if (v in phraseDict) {
      // @ts-ignore
      out[k] = phraseDict[v as keyof typeof phraseDict];
    }
  }

  // 2) Key-level defaults (HEADLINE, HERO_SUBHEAD, TAGLINE, CTA_*)
  for (const k of Object.keys(keyDict)) {
    const cur = out[k] as string | undefined;
    const enDefault = (keyDictEN as any)[k];
    if (!cur || cur === enDefault) {
      // @ts-ignore
      out[k] = (keyDict as any)[k];
    }
  }

  // 3) Ensure CTA presence
  if (!out.CTA_LABEL) out.CTA_LABEL = phraseDict["Get started"];
  if (!out.CTA_HEAD) out.CTA_HEAD = phraseDict["Ready when you are"];

  return out;
}
