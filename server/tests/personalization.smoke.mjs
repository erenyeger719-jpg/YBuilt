// node tests/personalization.smoke.mjs http://localhost:5050
import assert from "node:assert/strict";

const base = process.argv[2] || "http://localhost:5050";
async function post(path, body, headers = {}) {
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${path} failed: ${JSON.stringify(j)}`);
  return j;
}
const has = (list, x) => list.includes(x);

(async () => {
  // A) explicit via spec.intent.audience
  {
    const j = await post("/api/ai/act", {
      sessionId: "t-persona-a",
      spec: { intent: { audience: "developers" }, layout: { sections: ["cta-simple"] } },
      action: { kind: "retrieve", args: { sections: ["cta-simple"] } },
    });
    const got = j.result.sections;
    assert(has(got, "features-3col"), "developers should add features-3col");
    assert(!has(got, "pricing-simple"), "developers should not add pricing-simple");
    console.log("✓ developers (spec.intent) → features-3col");
  }

  // B) explicit via header
  {
    const j = await post(
      "/api/ai/act",
      {
        sessionId: "t-persona-b",
        spec: { layout: { sections: ["hero-basic","cta-simple"] } },
        action: { kind: "retrieve", args: { sections: ["hero-basic","cta-simple"] } },
      },
      { "x-audience": "founders" }
    );
    const got = j.result.sections;
    assert(has(got, "pricing-simple"), "founders should add pricing-simple");
    console.log("✓ founders (header) → pricing-simple");
  }

  // C) inference from copy when nothing explicit is set
  {
    const j = await post("/api/ai/act", {
      sessionId: "t-persona-c",
      spec: {
        copy: { HERO_SUBHEAD: "Tools built for developers and engineers" },
        layout: { sections: ["cta-simple"] },
      },
      action: { kind: "retrieve", args: { sections: ["cta-simple"] } },
    });
    const got = j.result.sections;
    assert(has(got, "features-3col"), "copy inference should add features-3col");
    console.log("✓ developers (copy inference) → features-3col");
  }

  console.log("— personalization.smoke: PASS");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
