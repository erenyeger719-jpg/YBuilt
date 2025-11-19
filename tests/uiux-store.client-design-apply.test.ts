// tests/uiux-store.client-design-apply.test.ts
// Simple TS test runner for applyDesignPackToSpec (client logic).
// Run with: pnpm tsx tests/uiux-store.client-design-apply.test.ts

import assert from "node:assert/strict";
import { applyDesignPackToSpec } from "../client/src/lib/design-apply.ts";

// Tiny helper to get roles from sections
function rolesOf(sections: any[]): string[] {
  return sections.map((s) => s?.role ?? "(none)");
}

function testAddPricingSectionAppendsAfterHero() {
  const spec = {
    sections: [
      { id: "nav-1", role: "navbar", content: { title: "Nav" } },
      { id: "hero-1", role: "hero", content: { headline: "Hero" } },
    ],
  };

  const pack: any = {
    id: "pricing_basic",
    slot: "pricing",
    version: 1,
    contentSchema: {
      fields: [{ key: "headline" }, { key: "sub" }],
    },
    specPatch: {
      sections: [
        {
          role: "pricing",
          content: { headline: "Simple pricing", plans: [] },
        },
      ],
    },
  };

  const result = applyDesignPackToSpec(spec, pack);

  assert.ok(result !== spec, "Expected a new spec object, not the same reference");
  assert.ok(
    Array.isArray(result.sections),
    "Expected result.sections to be an array",
  );
  assert.equal(
    result.sections.length,
    3,
    `Expected 3 sections after adding pricing, got ${result.sections.length}`,
  );

  const roles = rolesOf(result.sections);
  assert.deepEqual(
    roles,
    ["navbar", "hero", "pricing"],
    `Expected roles ["navbar","hero","pricing"], got ${JSON.stringify(roles)}`,
  );

  const pricing = result.sections[2];
  assert.equal(
    pricing.meta?.designPackId,
    "pricing_basic",
    "Expected pricing section to carry designPackId from pack",
  );
  assert.equal(
    pricing.meta?.slot,
    "pricing",
    "Expected pricing section meta.slot === 'pricing'",
  );

  console.log("  ✓ add pricing section: inserts after hero at bottom");
}

function testReplaceHeroSectionKeepsOtherSections() {
  const spec = {
    sections: [
      { id: "nav-1", role: "navbar", content: { title: "Nav" } },
      { id: "hero-1", role: "hero", content: { headline: "Old hero" } },
      { id: "footer-1", role: "footer", content: { text: "Footer" } },
    ],
  };

  const pack: any = {
    id: "hero_new",
    slot: "hero",
    version: 2,
    contentSchema: {
      fields: [{ key: "headline" }],
    },
    specPatch: {
      sections: [
        {
          role: "hero",
          content: { headline: "New hero from pack" },
        },
      ],
    },
  };

  const result = applyDesignPackToSpec(spec, pack, {
    mode: "replace",
    targetSectionId: "hero-1",
  });

  assert.equal(
    result.sections.length,
    3,
    `Expected same number of sections after replace, got ${result.sections.length}`,
  );

  // Navbar stays as-is
  assert.equal(
    result.sections[0].id,
    "nav-1",
    `Expected first section id nav-1, got ${result.sections[0].id}`,
  );

  // Footer stays as-is
  assert.equal(
    result.sections[2].id,
    "footer-1",
    `Expected last section id footer-1, got ${result.sections[2].id}`,
  );

  // Middle hero is replaced
  const hero = result.sections[1];
  assert.equal(hero.role, "hero", `Expected middle section role hero, got ${hero.role}`);
  assert.equal(
    hero.content?.headline,
    "New hero from pack",
    `Expected hero headline to be replaced, got ${hero.content?.headline}`,
  );
  assert.equal(
    hero.meta?.designPackId,
    "hero_new",
    "Expected hero meta.designPackId to be set from pack",
  );
  assert.equal(
    hero.meta?.slot,
    "hero",
    "Expected hero meta.slot === 'hero'",
  );

  console.log("  ✓ replace hero: only hero changes, navbar/footer untouched");
}

function testNonSectionKeysArePreserved() {
  const spec = {
    seo: { title: "Landing page" },
    theme: { color: "blue", font: "system" },
    sections: [
      { id: "hero-1", role: "hero", content: { headline: "Hero" } },
    ],
  };

  const pack: any = {
    id: "pricing_basic",
    slot: "pricing",
    specPatch: {
      sections: [
        { role: "pricing", content: { headline: "Pricing" } },
      ],
    },
  };

  const result = applyDesignPackToSpec(spec, pack);

  // Non-section keys should be preserved as-is
  assert.deepEqual(
    result.seo,
    spec.seo,
    `Expected seo to be preserved, got ${JSON.stringify(result.seo)}`,
  );
  assert.deepEqual(
    result.theme,
    spec.theme,
    `Expected theme to be preserved, got ${JSON.stringify(result.theme)}`,
  );

  console.log("  ✓ non-section keys (seo/theme) are preserved");
}

function testPackWithNoSectionsIsNoOp() {
  const spec = {
    sections: [
      { id: "hero-1", role: "hero", content: { headline: "Hero" } },
    ],
  };

  const pack: any = {
    id: "empty_pack",
    slot: "hero",
    // specPatch without sections → should be treated as empty
    specPatch: {},
  };

  const result = applyDesignPackToSpec(spec, pack);

  // Current implementation returns the original spec when there is nothing to insert.
  assert.strictEqual(
    result,
    spec,
    "Expected applyDesignPackToSpec to return original spec when pack has no sections",
  );

  console.log("  ✓ empty pack (no sections) is a no-op");
}

async function run() {
  console.log("▶ Running Design Apply (client) tests…");

  testAddPricingSectionAppendsAfterHero();
  testReplaceHeroSectionKeepsOtherSections();
  testNonSectionKeysArePreserved();
  testPackWithNoSectionsIsNoOp();

  console.log("✅ All Design Apply client tests passed.");
}

run().catch((err) => {
  console.error("❌ Design Apply client tests failed.");
  console.error(err);
  process.exit(1);
});
