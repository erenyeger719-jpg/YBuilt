// server/intent/slots.ts
// Deterministic, zero-LLM slot filler. Safe defaults; composer can still override
// with defaultsForSections()/hardenCopy() further down the pipeline.

type FillArgs = {
  prompt?: string;
  spec?: any;
  copy?: Record<string, any>;
};

function titleCase(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function fillSlots({ prompt = "", spec = {}, copy = {} }: FillArgs) {
  const out: Record<string, any> = { ...(copy || {}) };
  const filled: string[] = [];

  const sections: string[] = Array.isArray(spec?.layout?.sections) ? spec.layout.sections : [];
  const goal = String(spec?.intent?.goal || "").toLowerCase();

  const setIfMissing = (k: string, v: string) => {
    if (out[k] == null || String(out[k]).trim() === "") {
      out[k] = v;
      filled.push(k);
    }
  };

  // Core hero
  const promptHead = titleCase(prompt).split(" ").slice(0, 8).join(" ");
  setIfMissing("HEADLINE", promptHead || "Build Something People Want");
  setIfMissing("HERO_SUBHEAD", "Launch faster. Look credible. No fluff.");
  setIfMissing(
    "CTA_LABEL",
    goal === "waitlist" ? "Join the waitlist" : goal === "demo" ? "Request a demo" : "Get started"
  );
  setIfMissing("CTA_HEAD", "Ready when you are");
  setIfMissing("TAGLINE", "Simple • Fast • Credible");

  // Features (3-col)
  if (sections.includes("features-3col")) {
    const pairs: Array<[string, string]> = [
      ["FEATURE_1_TITLE", "Speed"],
      ["FEATURE_2_TITLE", "Clarity"],
      ["FEATURE_3_TITLE", "Trust"],
    ];
    const desc = "Crisp copy and clean design that just works.";
    pairs.forEach(([k, v], i) => {
      setIfMissing(k, v);
      setIfMissing(`FEATURE_${i + 1}_DESC`, desc);
    });
  }

  // Pricing (simple)
  if (sections.includes("pricing-simple")) {
    setIfMissing("PRICE_TIER_1_NAME", "Starter");
    setIfMissing("PRICE_TIER_1_PRICE", "₹0");
    setIfMissing("PRICE_TIER_2_NAME", "Pro");
    setIfMissing("PRICE_TIER_2_PRICE", "₹999");
  }

  // FAQ (accordion)
  if (sections.includes("faq-accordion")) {
    setIfMissing("FAQ_Q1", "What is this?");
    setIfMissing("FAQ_A1", "A fast way to ship credible pages.");
    setIfMissing("FAQ_Q2", "Can I customize it?");
    setIfMissing("FAQ_A2", "Yes—sections, copy, and styles are all adjustable.");
  }

  return { copy: out, filled };
}

export default { fillSlots };
