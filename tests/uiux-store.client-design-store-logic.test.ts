// tests/uiux-store.client-design-store-logic.test.ts
// Simple TS test runner for design-store-logic helpers.
// Run with: pnpm tsx tests/uiux-store.client-design-store-logic.test.ts

import assert from "node:assert/strict";
import {
  applyDesignPackFieldUpdate,
  getDesignPackEditorFields,
  publishDesignPackFromSection,
  applyDesignPackFromAutopilot,
  applyDesignPackByIdExternal,
} from "../client/src/pages/design-store-logic.ts";

// ---------- tiny fetch mocking helpers ----------

function makeMockResponse(body: any, status = 200) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return text;
    },
  };
}

async function withMockFetch(
  impl: (input: any, init?: any) => Promise<any>,
  fn: () => Promise<void>,
) {
  const original = (globalThis as any).fetch;
  (globalThis as any).fetch = impl;
  try {
    await fn();
  } finally {
    (globalThis as any).fetch = original;
  }
}

// ---------- tests: applyDesignPackFieldUpdate (field-level updates) ----------

async function testApplyDesignPackFieldUpdateUpdatesOnlyTarget() {
  const spec = {
    meta: { pageId: "page-1" },
    layout: {
      sections: ["hero-1", "footer-1"],
    },
    sections: {
      "hero-1": {
        id: "hero-1",
        role: "hero",
        content: {
          headline: "Old headline",
          sub: "Subheading",
        },
      },
      "footer-1": {
        id: "footer-1",
        role: "footer",
        content: {
          text: "Footer text",
        },
      },
    },
  };

  const next = applyDesignPackFieldUpdate({
    spec,
    sectionId: "hero-1",
    fieldKey: "content.headline",
    nextValue: "New headline",
  });

  // Immutable top-level & sections map
  assert.notStrictEqual(
    next,
    spec,
    "Expected a new Spec object, not the same reference",
  );
  assert.notStrictEqual(
    next.sections,
    spec.sections,
    "Expected sections map to be cloned",
  );
  assert.notStrictEqual(
    next.sections["hero-1"],
    spec.sections["hero-1"],
    "Expected updated section to be cloned",
  );

  // Meta & layout preserved
  assert.deepEqual(
    next.meta,
    spec.meta,
    "Expected meta to be preserved",
  );
  assert.deepEqual(
    next.layout,
    spec.layout,
    "Expected layout to be preserved",
  );

  // Hero content: headline updated, sub unchanged
  assert.equal(
    next.sections["hero-1"].content.headline,
    "New headline",
    "Expected hero headline to be updated",
  );
  assert.equal(
    next.sections["hero-1"].content.sub,
    "Subheading",
    "Expected sibling field (sub) to stay unchanged",
  );

  // Footer untouched
  assert.deepEqual(
    next.sections["footer-1"],
    spec.sections["footer-1"],
    "Expected non-target section to be unchanged",
  );

  // Original spec remains unchanged
  assert.equal(
    spec.sections["hero-1"].content.headline,
    "Old headline",
    "Expected original Spec to be unchanged",
  );

  console.log(
    "  ✓ applyDesignPackFieldUpdate: updates only target field & preserves others",
  );
}

async function testApplyDesignPackFieldUpdateMissingSectionNoStructuralChange() {
  const spec = {
    layout: { sections: ["hero-1"] },
    sections: {
      "hero-1": {
        id: "hero-1",
        role: "hero",
        content: { headline: "Hero" },
      },
    },
  };

  const next = applyDesignPackFieldUpdate({
    spec,
    sectionId: "missing-id",
    fieldKey: "content.headline",
    nextValue: "New",
  });

  // Function returns a cloned spec (by implementation), but structure should be identical
  assert.notStrictEqual(
    next,
    spec,
    "Expected a cloned Spec object when section is missing",
  );
  assert.deepEqual(
    next,
    spec,
    "Expected no structural changes when section is missing",
  );

  console.log(
    "  ✓ applyDesignPackFieldUpdate: missing section → cloned Spec with no changes",
  );
}

async function testApplyDesignPackFieldUpdateCreatesNestedKey() {
  const spec = {
    layout: { sections: ["hero-1"] },
    sections: {
      "hero-1": {
        id: "hero-1",
        role: "hero",
        content: {
          headline: "Hero",
        },
      },
    },
  };

  const next = applyDesignPackFieldUpdate({
    spec,
    sectionId: "hero-1",
    fieldKey: "content.tagline",
    nextValue: "Fresh tagline",
  });

  assert.equal(
    next.sections["hero-1"].content.tagline,
    "Fresh tagline",
    "Expected nested path to be created",
  );
  assert.equal(
    (spec.sections["hero-1"] as any).content.tagline,
    undefined,
    "Expected original Spec to remain without new nested key",
  );

  console.log(
    "  ✓ applyDesignPackFieldUpdate: creates missing nested keys safely",
  );
}

// ---------- tests: getDesignPackEditorFields (mapping schema → fields) ----------

async function testGetDesignPackEditorFieldsBasicMapping() {
  const spec = {
    sections: {
      "hero-1": {
        id: "hero-1",
        role: "hero",
        meta: {
          designPackId: "hero_pack_1",
        },
        content: {
          headline: "Hero X",
          sub: "Sub X",
        },
      },
    },
  };

  await withMockFetch(async (input: any) => {
    const url = String(input);
    if (url.startsWith("/api/design-store/pack/hero_pack_1")) {
      // getDesignStorePack expects an envelope like { ok, pack: { ... } }
      return makeMockResponse({
        ok: true,
        pack: {
          id: "hero_pack_1",
          slot: "hero",
          contentSchema: {
            fields: [
              { key: "headline", label: "Headline" },
              { key: "sub", label: "Subheading" },
            ],
          },
        },
      });
    }

    throw new Error(
      "Unexpected URL in testGetDesignPackEditorFieldsBasicMapping: " + url,
    );
  }, async () => {
    const fields = await getDesignPackEditorFields({
      spec: spec as any,
      sectionId: "hero-1",
    });

    assert.ok(Array.isArray(fields), "Expected array of fields");
    assert.equal(fields.length, 2, "Expected 2 editor fields");

    const headlineField = fields[0];
    const subField = fields[1];

    assert.equal(
      headlineField.key,
      "content.headline",
      "Expected key/path for headline",
    );
    assert.equal(
      headlineField.label,
      "Headline",
      "Expected label from schema",
    );
    assert.equal(
      headlineField.type,
      "text",
      "Expected default type text",
    );
    assert.equal(
      headlineField.value,
      "Hero X",
      "Expected value from spec.content.headline",
    );

    assert.equal(
      subField.key,
      "content.sub",
      "Expected key/path for sub",
    );
    assert.equal(
      subField.label,
      "Subheading",
      "Expected label from schema",
    );
    assert.equal(
      subField.value,
      "Sub X",
      "Expected value from spec.content.sub",
    );
  });

  console.log(
    "  ✓ getDesignPackEditorFields: maps schema fields to values from Spec",
  );
}

async function testGetDesignPackEditorFieldsMissingPackReturnsEmpty() {
  const spec = {
    sections: {
      "hero-1": {
        id: "hero-1",
        role: "hero",
        meta: {
          designPackId: "missing_pack",
        },
        content: {
          headline: "Hero",
        },
      },
    },
  };

  await withMockFetch(async (_input: any) => {
    // Simulate 404 / not found; getDesignStorePack will see status 404 and return null
    return makeMockResponse(
      {
        error: "not_found",
      },
      404,
    );
  }, async () => {
    const fields = await getDesignPackEditorFields({
      spec: spec as any,
      sectionId: "hero-1",
    });

    assert.ok(Array.isArray(fields), "Expected array");
    assert.equal(
      fields.length,
      0,
      "Expected no fields when pack could not be fetched",
    );
  });

  console.log(
    "  ✓ getDesignPackEditorFields: missing pack → [] and no crash",
  );
}

// ---------- tests: publishDesignPackFromSection (saving user packs) ----------

async function testPublishDesignPackFromSectionHappyPath() {
  const spec = {
    theme: { primary: "#000" },
    tokens: { radius: 16 },
    layout: { sections: ["hero-1", "footer-1"] },
    sections: {
      "hero-1": {
        id: "hero-1",
        role: "hero",
        content: { headline: "Hero" },
      },
      "footer-1": {
        id: "footer-1",
        role: "footer",
        content: { text: "Footer" },
      },
    },
  };

  let capturedBody: any = null;

  await withMockFetch(async (input: any, init?: any) => {
    const url = String(input);
    if (url === "/api/design-store/publish") {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null;
      return makeMockResponse({ ok: true });
    }
    throw new Error(
      "Unexpected URL in testPublishDesignPackFromSectionHappyPath: " + url,
    );
  }, async () => {
    const ok = await publishDesignPackFromSection({
      spec: spec as any,
      sectionId: "hero-1",
      name: "My Hero",
      slot: "hero",
      description: "My saved hero layout",
    });

    assert.equal(
      ok,
      true,
      "Expected publishDesignPackFromSection to resolve true",
    );
    assert.ok(capturedBody, "Expected request body to be sent");

    // Basic payload shape
    assert.equal(capturedBody.name, "My Hero");
    assert.equal(capturedBody.slot, "hero");
    assert.equal(capturedBody.origin, "user");

    const patch = capturedBody.specPatch || {};
    assert.deepEqual(
      patch.layout.sections,
      ["hero-1"],
      "Expected specPatch.layout.sections to contain only the saved section",
    );
    assert.deepEqual(
      Object.keys(patch.sections || {}),
      ["hero-1"],
      "Expected specPatch.sections map to contain only the saved section",
    );
  });

  console.log(
    "  ✓ publishDesignPackFromSection: builds minimal specPatch & POSTs correctly",
  );
}

async function testPublishDesignPackFromSectionMissingSectionReturnsFalse() {
  const spec = {
    layout: { sections: ["hero-1"] },
    sections: {
      "hero-1": {
        id: "hero-1",
        role: "hero",
        content: { headline: "Hero" },
      },
    },
  };

  let called = false;

  await withMockFetch(async () => {
    called = true;
    return makeMockResponse({ ok: true });
  }, async () => {
    const ok = await publishDesignPackFromSection({
      spec: spec as any,
      sectionId: "missing-id",
      name: "My Hero",
      slot: "hero",
      description: "desc",
    });

    assert.equal(ok, false, "Expected false when section does not exist");
    assert.equal(
      called,
      false,
      "Expected no network call when section does not exist",
    );
  });

  console.log(
    "  ✓ publishDesignPackFromSection: missing section → false & no network call",
  );
}

// ---------- tests: applyDesignPackFromAutopilot (bridge) ----------

async function testApplyDesignPackFromAutopilotHappyPath() {
  const applied: any[] = [];

  await withMockFetch(async (input: any) => {
    const url = String(input);

    if (url.startsWith("/api/design-store/list")) {
      // Expect slot=hero & q=minimal in the query string
      assert.ok(
        url.includes("slot=hero"),
        "Expected slot=hero in design-store list URL",
      );
      assert.ok(
        url.includes("q=minimal"),
        "Expected q=minimal in design-store list URL",
      );

      return makeMockResponse({
        ok: true,
        items: [{ id: "hero_minimal_1", slot: "hero" }],
      });
    }

    if (url.startsWith("/api/design-store/pack/hero_minimal_1")) {
      return makeMockResponse({
        pack: {
          id: "hero_minimal_1",
          slot: "hero",
          name: "Hero minimal 1",
        },
      });
    }

    throw new Error(
      "Unexpected URL in testApplyDesignPackFromAutopilotHappyPath: " + url,
    );
  }, async () => {
    await applyDesignPackFromAutopilot({
      slot: "hero",
      styleHint: "minimal",
      actions: {
        applyDesignPackFromStore(pack) {
          applied.push(pack);
        },
      },
    });

    assert.equal(
      applied.length,
      1,
      "Expected exactly one pack to be applied",
    );
    assert.equal(
      applied[0].id,
      "hero_minimal_1",
      "Expected applied pack id to match first list item",
    );
  });

  console.log(
    "  ✓ applyDesignPackFromAutopilot: fetches list + pack and applies first result",
  );
}

async function testApplyDesignPackFromAutopilotNoResultsIsNoOp() {
  const applied: any[] = [];

  await withMockFetch(async (input: any) => {
    const url = String(input);
    if (url.startsWith("/api/design-store/list")) {
      return makeMockResponse({
        ok: true,
        items: [],
      });
    }
    throw new Error(
      "Unexpected URL in testApplyDesignPackFromAutopilotNoResultsIsNoOp: " +
        url,
    );
  }, async () => {
    await applyDesignPackFromAutopilot({
      slot: "hero",
      styleHint: "minimal",
      actions: {
        applyDesignPackFromStore(pack) {
          applied.push(pack);
        },
      },
    });

    assert.equal(
      applied.length,
      0,
      "Expected no pack to be applied when list is empty",
    );
  });

  console.log(
    "  ✓ applyDesignPackFromAutopilot: empty list → no-op (no apply)",
  );
}

async function testApplyDesignPackFromAutopilotSwallowsErrors() {
  const applied: any[] = [];

  await withMockFetch(async () => {
    // Simulate network error / backend failure
    throw new Error("Design store down");
  }, async () => {
    // Should not throw
    await applyDesignPackFromAutopilot({
      slot: "hero",
      styleHint: "minimal",
      actions: {
        applyDesignPackFromStore(pack) {
          applied.push(pack);
        },
      },
    });

    assert.equal(
      applied.length,
      0,
      "Expected no pack to be applied when list fetch throws",
    );
  });

  console.log(
    "  ✓ applyDesignPackFromAutopilot: errors are swallowed, no crash",
  );
}

// ---------- tests: applyDesignPackByIdExternal (canvas bridge) ----------

async function testApplyDesignPackByIdExternalFirstLayout() {
  const packId = "hero_first";
  let capturedSpec: any = null;
  const logs: any[] = [];
  const says: string[] = [];

  await withMockFetch(async (input: any) => {
    const url = String(input);
    if (url.startsWith("/api/design-store/pack/hero_first")) {
      return makeMockResponse({
        ok: true,
        pack: {
          id: "hero_first",
          name: "Hero First",
          specPatch: {
            meta: { pageId: "page-1" },
            layout: { sections: ["hero-1"] },
            sections: {
              "hero-1": {
                id: "hero-1",
                role: "hero",
                content: { headline: "From pack" },
              },
            },
          },
        },
      });
    }
    throw new Error(
      "Unexpected URL in testApplyDesignPackByIdExternalFirstLayout: " + url,
    );
  }, async () => {
    const ok = await applyDesignPackByIdExternal(packId, {
      getBaseSpec: () => null,
      recomposeGuarded: async (next: any) => {
        capturedSpec = next;
        return true;
      },
      pushAutoLog(role, text) {
        logs.push({ role, text });
      },
      say(text) {
        says.push(text);
      },
    });

    assert.equal(
      ok,
      true,
      "Expected applyDesignPackByIdExternal to resolve true for first layout.",
    );
    assert.ok(
      capturedSpec,
      "Expected recomposeGuarded to be called with a Spec.",
    );
    assert.deepEqual(
      capturedSpec.layout.sections,
      ["hero-1"],
      "Expected layout.sections to come from pack specPatch when no base spec exists.",
    );
    assert.equal(logs.length, 1, "Expected one autopilot log entry.");
    assert.equal(logs[0].role, "pilot");
    assert.ok(
      logs[0].text.includes("Applied design pack"),
      "Expected autopilot log message to mention applied design pack.",
    );
    assert.ok(
      logs[0].text.includes("first layout"),
      "Expected autopilot log to mention first layout.",
    );
    assert.equal(
      says[0],
      "Applied design from the store.",
      "Expected speech feedback for first-layout apply.",
    );
  });

  console.log(
    "  ✓ applyDesignPackByIdExternal: uses pack as first layout when no base Spec",
  );
}

async function testApplyDesignPackByIdExternalMergesWithBaseSpec() {
  const packId = "hero_merge";

  const baseSpec = {
    meta: { pageId: "page-1" },
    layout: { sections: ["navbar-1"] },
    sections: {
      "navbar-1": {
        id: "navbar-1",
        role: "navbar",
        content: { brand: "Site" },
      },
    },
  };

  let receivedSpec: any = null;
  const logs: any[] = [];
  const says: string[] = [];

  await withMockFetch(async (input: any) => {
    const url = String(input);
    if (url.startsWith("/api/design-store/pack/hero_merge")) {
      return makeMockResponse({
        ok: true,
        pack: {
          id: "hero_merge",
          name: "Hero Merge",
          specPatch: {
            layout: { sections: ["hero-1"] },
            sections: {
              "hero-1": {
                id: "hero-1",
                role: "hero",
                content: { headline: "From pack" },
              },
            },
          },
        },
      });
    }
    throw new Error(
      "Unexpected URL in testApplyDesignPackByIdExternalMergesWithBaseSpec: " +
        url,
    );
  }, async () => {
    const ok = await applyDesignPackByIdExternal(packId, {
      getBaseSpec: () => baseSpec as any,
      recomposeGuarded: async (next: any) => {
        receivedSpec = next;
        return true;
      },
      pushAutoLog(role, text) {
        logs.push({ role, text });
      },
      say(text) {
        says.push(text);
      },
    });

    assert.equal(
      ok,
      true,
      "Expected applyDesignPackByIdExternal to resolve true when merge succeeds.",
    );
    assert.ok(receivedSpec, "Expected recomposeGuarded to get merged Spec.");
    assert.deepEqual(
      receivedSpec.layout.sections,
      ["navbar-1", "hero-1"],
      "Expected merged layout.sections to keep base then append pack sections.",
    );
    assert.ok(
      receivedSpec.sections["navbar-1"],
      "Expected base navbar section to be preserved in merged Spec.",
    );
    assert.ok(
      receivedSpec.sections["hero-1"],
      "Expected pack hero section to be present in merged Spec.",
    );
    assert.equal(logs.length, 1, "Expected one autopilot log entry.");
    assert.equal(logs[0].role, "pilot");
    assert.ok(
      logs[0].text.includes("to this page"),
      "Expected autopilot log to reference 'to this page'.",
    );
    assert.equal(
      says[0],
      "Design pack applied.",
      "Expected speech feedback for merged apply.",
    );
  });

  console.log(
    "  ✓ applyDesignPackByIdExternal: merges pack patch into existing Spec",
  );
}

async function testApplyDesignPackByIdExternalErrorPath() {
  const logs: any[] = [];
  const says: string[] = [];
  let recomposeCalled = false;

  await withMockFetch(async () => {
    // Simulate network failure for getDesignStorePack
    throw new Error("Network down");
  }, async () => {
    const ok = await applyDesignPackByIdExternal("any-pack", {
      getBaseSpec: () => null,
      recomposeGuarded: async () => {
        recomposeCalled = true;
        return true;
      },
      pushAutoLog(role, text) {
        logs.push({ role, text });
      },
      say(text) {
        says.push(text);
      },
    });

    assert.equal(
      ok,
      false,
      "Expected applyDesignPackByIdExternal to return false on fetch error.",
    );
    assert.equal(
      recomposeCalled,
      false,
      "Expected recomposeGuarded not to be called on error.",
    );
    assert.equal(logs.length, 1, "Expected one autopilot error log.");
    assert.equal(logs[0].role, "pilot");
    assert.ok(
      logs[0].text.includes("Could not apply design pack"),
      "Expected autopilot log to mention error applying design pack.",
    );
    assert.ok(
      says[0].includes("apply that design"),
      "Expected speech feedback to mention failing to apply design.",
    );
  });

  console.log(
    "  ✓ applyDesignPackByIdExternal: returns false and logs on error",
  );
}

// ---------- runner ----------

async function run() {
  console.log("▶ Running Design Store logic (client) tests…");

  await testApplyDesignPackFieldUpdateUpdatesOnlyTarget();
  await testApplyDesignPackFieldUpdateMissingSectionNoStructuralChange();
  await testApplyDesignPackFieldUpdateCreatesNestedKey();
  await testGetDesignPackEditorFieldsBasicMapping();
  await testGetDesignPackEditorFieldsMissingPackReturnsEmpty();
  await testPublishDesignPackFromSectionHappyPath();
  await testPublishDesignPackFromSectionMissingSectionReturnsFalse();
  await testApplyDesignPackFromAutopilotHappyPath();
  await testApplyDesignPackFromAutopilotNoResultsIsNoOp();
  await testApplyDesignPackFromAutopilotSwallowsErrors();
  await testApplyDesignPackByIdExternalFirstLayout();
  await testApplyDesignPackByIdExternalMergesWithBaseSpec();
  await testApplyDesignPackByIdExternalErrorPath();

  console.log("✅ All Design Store logic client tests passed.");
}

run().catch((err) => {
  console.error("❌ Design Store logic client tests failed.");
  console.error(err);
  process.exit(1);
});
