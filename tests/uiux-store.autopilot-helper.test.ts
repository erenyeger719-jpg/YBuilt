// tests/uiux-store.autopilot-helper.test.ts
// Simple TS test runner for applyDesignPackFromAutopilot.
// Run with: pnpm tsx tests/uiux-store.autopilot-helper.test.ts

import assert from "node:assert/strict";
import { applyDesignPackFromAutopilot } from "../client/src/pages/design-store-logic.ts";

const originalFetch = (globalThis as any).fetch;

function setFetchMock(handler: (url: string) => any) {
  (globalThis as any).fetch = (async (input: any) => {
    const url = typeof input === "string" ? input : String(input);
    return handler(url);
  }) as any;
}

async function testAppliesFirstPackWhenListHasItems() {
  let appliedPack: any = null;

  setFetchMock((url) => {
    // First call: list endpoint
    if (url.includes("/api/design-store/list")) {
      const fakePack = {
        id: "hero_minimal_dark",
        name: "Minimal dark hero",
        slot: "hero",
      };

      return {
        ok: true,
        async json() {
          return { ok: true, items: [fakePack] };
        },
      } as any;
    }

    // Second call: pack by id endpoint (if your helper fetches it)
    if (url.includes("/api/design-store/pack/")) {
      const fullPack = {
        id: "hero_minimal_dark",
        name: "Minimal dark hero",
        slot: "hero",
      };

      return {
        ok: true,
        async json() {
          return { ok: true, pack: fullPack };
        },
      } as any;
    }

    throw new Error(`Unexpected fetch url in test: ${url}`);
  });

  await applyDesignPackFromAutopilot({
    slot: "hero",
    styleHint: "minimal",
    actions: {
      applyDesignPackFromStore: async (pack: any) => {
        appliedPack = pack;
      },
    },
  } as any);

  assert.ok(appliedPack, "expected applyDesignPackFromStore to be called");
  assert.equal(
    appliedPack.id,
    "hero_minimal_dark",
    `expected pack id hero_minimal_dark, got ${appliedPack.id}`,
  );
}

async function testDoesNothingWhenListEmpty() {
  let called = false;

  setFetchMock((url) => {
    if (url.includes("/api/design-store/list")) {
      return {
        ok: true,
        async json() {
          return { ok: true, items: [] };
        },
      } as any;
    }

    throw new Error(`Unexpected fetch url in empty-list test: ${url}`);
  });

  await applyDesignPackFromAutopilot({
    slot: "hero",
    styleHint: "minimal",
    actions: {
      applyDesignPackFromStore: async () => {
        called = true;
      },
    },
  } as any);

  assert.equal(
    called,
    false,
    "applyDesignPackFromStore should NOT be called when no packs exist",
  );
}

async function run() {
  console.log("▶ Running Autopilot helper → Design Store tests…");

  await testAppliesFirstPackWhenListHasItems();
  console.log("  ✓ applies first design pack when list is non-empty");

  await testDoesNothingWhenListEmpty();
  console.log("  ✓ does nothing when the store list is empty");

  console.log("✅ All Autopilot helper tests passed.");
}

// run and restore fetch
run()
  .catch((err) => {
    console.error("❌ Autopilot helper tests failed.");
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    (globalThis as any).fetch = originalFetch;
  });
