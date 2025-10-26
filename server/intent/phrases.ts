// server/intent/phrases.ts
type IntentLite = {
  goal?: "waitlist" | "demo" | "purchase" | "contact";
  vibe?: "minimal" | "playful" | "serious";
};

const BANK: Record<string, Record<string, string[]>> = {
  HERO_TITLE: {
    minimal: [
      "Build faster. Ship calmer.",
      "The clean way to launch.",
      "Minimal stack. Maximum signal."
    ],
    playful: [
      "Press go. Get wow.",
      "Tiny app, big vibes.",
      "Click, boom, shipped."
    ],
    serious: [
      "Operational clarity for modern teams",
      "Ship reliable software, predictably",
      "From idea to impact—without the noise"
    ],
  },
  HERO_SUB: {
    minimal: [
      "Opinionated defaults for landing pages and simple flows.",
      "No sprawl—sections, slots, and instant previews.",
    ],
    playful: [
      "Pick some blocks, sprinkle copy, done. Free refills.",
      "Your site’s glow-up, minus the homework.",
    ],
    serious: [
      "Composable sections, strong a11y, and reviewable diffs.",
      "Craft high-quality pages with measurable outcomes.",
    ],
  },
  CTA_LABEL: {
    minimal: ["Join the waitlist", "Get started", "Try the demo"],
    playful: ["Let’s go", "I’m in", "Make one for me"],
    serious: ["Start now", "Request access", "Book a demo"],
  },
  CTA_HEAD: {
    minimal: ["Ready when you are", "Launch in minutes"],
    playful: ["We preheated the oven", "Let’s ship something shiny"],
    serious: ["Production-grade from day one", "Less risk, more signal"],
  },
  F1_TITLE: {
    minimal: ["Sections, not spaghetti"],
    playful: ["Pick-a-block magic"],
    serious: ["Composable building blocks"],
  },
  F1_SUB: {
    minimal: ["Hero, features, CTA—clean defaults you can trust."],
    playful: ["Drag the vibes into place, we’ll do the grown-up bits."],
    serious: ["A small library of audited, accessible sections."],
  },
  F2_TITLE: {
    minimal: ["Copy by tiny slots"],
    playful: ["Words, but snack-sized"],
    serious: ["Structured copy inputs"],
  },
  F2_SUB: {
    minimal: ["Short labels fill exact slots. No rambling."],
    playful: ["No essays. Just zingers."],
    serious: ["Deterministic slot text for predictable output."],
  },
  F3_TITLE: {
    minimal: ["Preview, then publish"],
    playful: ["Instant glow-up"],
    serious: ["Reviewable diffs"],
  },
  F3_SUB: {
    minimal: ["Every change shows up in a live preview URL."],
    playful: ["Click. Boom. Pretty."],
    serious: ["Forked previews with QA checks and shareable links."],
  },
};

function vibeKey(v: string | undefined) {
  return (v === "playful" || v === "serious") ? v : "minimal";
}

export function pickPhrase(slot: keyof typeof BANK, intent: IntentLite = {}) {
  const v = vibeKey(intent.vibe);
  const list = BANK[slot]?.[v] || [];
  if (!list.length) return "";
  // stable but varied pick: goal influences index
  const idx = Math.abs(((intent.goal || "waitlist").charCodeAt(0) || 1) % list.length);
  return list[idx];
}
