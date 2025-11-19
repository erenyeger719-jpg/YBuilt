// test/uiux-store.design-logic.test.ts
// Simple TS test runner for UI/UX Store logic.
// Run with: pnpm tsx test/uiux-store.design-logic.test.ts

import assert from "node:assert/strict";
import { applyDesignPackFieldUpdate } from "../client/src/pages/design-store-logic.ts";

// Helper to pretty-print sections in error messages
function dump(v: unknown) {
  return JSON.stringify(v, null, 2);
}

function testUpdateExistingHeadline() {
  const spec: any = {
    sections: {
      hero: {
        content: {
          headline: "Old headline",
          sub: "Old sub",
        },
      },
    },
  };

  const next = applyDesignPackFieldUpdate({
    spec,
    sectionId: "hero",
    fieldKey: "content.headline",
    nextValue: "New headline",
  });

  assert.ok(next.sections?.hero, "hero section should still exist");
  assert.equal(
    next.sections.hero.content.headline,
    "New headline",
    "headline should update to new value",
  );
  assert.equal(
    next.sections.hero.content.sub,
    "Old sub",
    "other fields should not be touched",
  );
}

function testMissingSectionDoesNothing() {
  const spec: any = {
    sections: {
      hero: {
        content: { headline: "Hero" },
      },
    },
  };

  const next = applyDesignPackFieldUpdate({
    spec,
    sectionId: "missing",
    fieldKey: "content.headline",
    nextValue: "New",
  });

  // Should not magically invent a "missing" section
  assert.ok(
    !next.sections.missing,
    `expected no 'missing' section, got: ${dump(next.sections.missing)}`,
  );
  // Existing section should stay as-is
  assert.equal(
    next.sections.hero.content.headline,
    "Hero",
    "existing hero headline should stay the same",
  );
}

function testCreatesNestedPathIfMissing() {
  const spec: any = {
    sections: {
      hero: {
        content: {},
      },
    },
  };

  const next = applyDesignPackFieldUpdate({
    spec,
    sectionId: "hero",
    fieldKey: "content.tagline",
    nextValue: "Fresh tagline",
  });

  assert.ok(next.sections?.hero?.content, "hero.content should exist");
  assert.equal(
    next.sections.hero.content.tagline,
    "Fresh tagline",
    "tagline should be created under content",
  );
}

function run() {
  console.log("▶ Running UI/UX Store logic tests…");

  testUpdateExistingHeadline();
  console.log("  ✓ updates existing content.headline correctly");

  testMissingSectionDoesNothing();
  console.log("  ✓ does nothing when sectionId does not exist");

  testCreatesNestedPathIfMissing();
  console.log("  ✓ creates missing nested path under content");

  console.log("✅ All UI/UX Store logic tests passed.");
}

run();
