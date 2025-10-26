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
      "Minimal stack. Maximum signal.",
      "Smaller surface, stronger outcomes.",
      "Fewer knobs. Better defaults.",
      "Clarity beats cleverness."
    ],
    playful: [
      "Press go. Get wow.",
      "Tiny app, big vibes.",
      "Click, boom, shipped.",
      "Snack-size setup, full-course shine.",
      "Tap tap—ta-da.",
      "Make it cute, keep it quick."
    ],
    serious: [
      "Operational clarity for modern teams",
      "Ship reliable software, predictably",
      "From idea to impact—without the noise",
      "Outcomes over ornament",
      "Production discipline, startup speed",
      "Less surface area, fewer incidents"
    ],
  },
  HERO_SUB: {
    minimal: [
      "Opinionated defaults for landing pages and simple flows.",
      "No sprawl—sections, slots, and instant previews.",
      "Choose sections, tweak copy, publish with confidence.",
      "Tight system, clean UI, measurable wins.",
      "Everything you need, nothing to babysit.",
      "Designed to remove decisions, not control."
    ],
    playful: [
      "Pick some blocks, sprinkle copy, done. Free refills.",
      "Your site’s glow-up, minus the homework.",
      "Drag a vibe, press ship, look smart.",
      "Small moves, big sparkle.",
      "You handle the flavor—we’ll plate it.",
      "Clicks not chores."
    ],
    serious: [
      "Composable sections, strong a11y, and reviewable diffs.",
      "Craft high-quality pages with measurable outcomes.",
      "Deterministic changes, low risk, clear reviews.",
      "Standards-first UX with verifiable quality.",
      "Fewer regressions, faster approvals.",
      "Guardrails that scale."
    ],
  },
  CTA_LABEL: {
    minimal: ["Join the waitlist", "Get started", "Try the demo", "Preview now", "Continue", "Go minimal"],
    playful: ["Let’s go", "I’m in", "Make one for me", "Spin it up", "Surprise me", "Do the thing"],
    serious: ["Start now", "Request access", "Book a demo", "Begin trial", "Evaluate now", "See it working"],
  },
  CTA_HEAD: {
    minimal: ["Ready when you are", "Launch in minutes", "Make one, iterate later", "Setup that respects time"],
    playful: ["We preheated the oven", "Let’s ship something shiny", "Your turn to press go", "Blink and it’s live"],
    serious: ["Production-grade from day one", "Less risk, more signal", "Fewer edits to ship", "Quality by default"],
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
