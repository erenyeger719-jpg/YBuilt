// test/uiux-store.autopilot-design-store.test.ts
// Simple TS test runner for Autopilot ↔ Design Store bridge.
// Run with: pnpm tsx test/uiux-store.autopilot-design-store.test.ts

import assert from "node:assert/strict";
import { Autopilot } from "../client/src/lib/autopilot.ts";

function makePilot(applyDesignPackMock: (arg: any) => void) {
  const pilot = new Autopilot({
    say: () => {},
    askConfirm: async () => true,
    log: () => {},
    actions: {
      // Other actions can be no-ops for this test
      setPrompt: () => {},
      composeInstant: async () => {},
      applyChip: async () => {},
      setZeroJs: async () => {},
      runArmyTop: async () => {},
      blendTopWinner: async () => {},
      startBasicAB: () => {},
      toggleAB: () => {},
      setABAuto: () => {},
      viewArm: () => {},
      setAutopilot: () => {},
      undo: () => {},
      reportStatus: async () => "",
      setGoalAndApply: async () => {},
      setDataSkin: async () => {},
      toggleComments: () => {},
      applyDesignPack: applyDesignPackMock,
    },
  } as any);

  return pilot as any; // loosen types for this simple test
}

async function testHeroCommand() {
  const calls: any[] = [];
  const pilot = makePilot((arg) => calls.push(arg));

  await pilot.handle("use a minimal hero from the design store");

  assert.equal(
    calls.length,
    1,
    `expected applyDesignPack to be called once, got ${calls.length}`,
  );

  const arg = calls[0];
  assert.equal(arg.slot, "hero", `expected slot "hero", got ${arg.slot}`);
  assert.ok(
    String(arg.styleHint || "").toLowerCase().includes("minimal"),
    `expected styleHint to contain "minimal", got ${arg.styleHint}`,
  );
}

async function testPricingCommand() {
  const calls: any[] = [];
  const pilot = makePilot((arg) => calls.push(arg));

  await pilot.handle("add a pricing section from the design store");

  assert.equal(
    calls.length,
    1,
    `expected applyDesignPack to be called once, got ${calls.length}`,
  );

  const arg = calls[0];
  assert.equal(arg.slot, "pricing", `expected slot "pricing", got ${arg.slot}`);
}

async function run() {
  console.log("▶ Running Autopilot ↔ Design Store tests…");

  await testHeroCommand();
  console.log('  ✓ "minimal hero" command maps to slot hero + styleHint');

  await testPricingCommand();
  console.log('  ✓ "pricing section" command maps to slot pricing');

  console.log("✅ All Autopilot ↔ Design Store tests passed.");
}

run().catch((err) => {
  console.error("❌ Autopilot ↔ Design Store tests failed.");
  console.error(err);
  process.exit(1);
});
