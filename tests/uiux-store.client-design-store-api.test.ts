// tests/uiux-store.client-design-store-api.test.ts
// Simple TS test runner for client design-store.ts helpers.
// Run with: pnpm tsx tests/uiux-store.client-design-store-api.test.ts

import assert from "node:assert/strict";
import {
  listDesignStorePacks,
  getDesignStorePack,
  publishDesignStorePack,
} from "../client/src/lib/design-store.ts";

function makeMockResponse(body: any, status = 200, ok = status >= 200 && status < 300) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(body);
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

async function testListDesignStorePacksSuccess() {
  await withMockFetch(async () => {
    return makeMockResponse({
      ok: true,
      items: [
        {
          id: "hero_minimal_dark",
          slot: "hero",
          name: "Hero minimal dark",
          specPatch: { sections: [] },
        },
      ],
    });
  }, async () => {
    const items = await listDesignStorePacks();
    assert.ok(Array.isArray(items), "Expected array from listDesignStorePacks");
    assert.equal(items.length, 1, "Expected exactly one pack in list");
    assert.equal(
      items[0].id,
      "hero_minimal_dark",
      "Expected returned pack to have correct id",
    );
  });

  console.log("  ✓ listDesignStorePacks: basic success case");
}

async function testListDesignStorePacksBackendError() {
  await withMockFetch(async () => {
    return makeMockResponse({
      ok: false,
      error: "store_disabled",
    });
  }, async () => {
    let threw = false;
    try {
      await listDesignStorePacks();
    } catch (err: any) {
      threw = true;
      assert.match(
        String(err.message),
        /store_disabled|Design store list failed/,
        "Expected error message to mention backend failure",
      );
    }
    assert.ok(
      threw,
      "Expected listDesignStorePacks to throw when backend returns ok:false",
    );
  });

  console.log("  ✓ listDesignStorePacks: backend ok:false surfaces as error");
}

async function testListDesignStorePacksNetworkError() {
  await withMockFetch(async () => {
    throw new Error("Network down");
  }, async () => {
    let threw = false;
    try {
      await listDesignStorePacks();
    } catch (err: any) {
      threw = true;
      assert.match(
        String(err.message),
        /Network down/,
        "Expected network error to bubble up",
      );
    }
    assert.ok(
      threw,
      "Expected listDesignStorePacks to throw on network error",
    );
  });

  console.log("  ✓ listDesignStorePacks: network errors bubble cleanly");
}

async function testGetDesignStorePackSuccess() {
  await withMockFetch(async () => {
    return makeMockResponse({
      ok: true,
      pack: {
        id: "hero_minimal_dark",
        slot: "hero",
        name: "Hero minimal dark",
      },
    });
  }, async () => {
    const pack = await getDesignStorePack("hero_minimal_dark");
    assert.ok(pack, "Expected non-null pack");
    assert.equal(
      pack?.id,
      "hero_minimal_dark",
      "Expected pack.id to match requested id",
    );
  });

  console.log("  ✓ getDesignStorePack: success with pack payload");
}

async function testGetDesignStorePack404ReturnsNull() {
  await withMockFetch(async () => {
    return makeMockResponse(
      {
        ok: false,
        error: "not_found",
      },
      404,
      false,
    );
  }, async () => {
    const pack = await getDesignStorePack("does_not_exist");
    assert.equal(
      pack,
      null,
      "Expected getDesignStorePack to return null for 404",
    );
  });

  console.log("  ✓ getDesignStorePack: 404 → null");
}

async function testPublishDesignStorePackSuccess() {
  await withMockFetch(async (_input, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    return makeMockResponse(
      {
        ok: true,
        pack: {
          ...body,
          id: body.id || "new_pack_id",
        },
      },
      201,
    );
  }, async () => {
    const pack = await publishDesignStorePack({
      id: "publish_test",
      slot: "hero",
      specPatch: { sections: [] },
      name: "Publish test",
    });

    assert.ok(pack, "Expected pack returned from publish");
    assert.equal(
      pack.id,
      "publish_test",
      "Expected publish to echo back id",
    );
    assert.equal(
      pack.slot,
      "hero",
      "Expected publish to echo back slot",
    );
  });

  console.log("  ✓ publishDesignStorePack: success returns saved pack");
}

async function testPublishDesignStorePackBackendError() {
  await withMockFetch(async () => {
    return makeMockResponse(
      {
        ok: false,
        error: "validation_failed",
      },
      400,
      false,
    );
  }, async () => {
    let threw = false;
    try {
      await publishDesignStorePack({
        // Deliberately bad body: missing slot/specPatch, etc.
      } as any);
    } catch (err: any) {
      threw = true;
      assert.match(
        String(err.message),
        /validation_failed|status 400/,
        "Expected publish error to mention validation failure or status",
      );
    }
    assert.ok(
      threw,
      "Expected publishDesignStorePack to throw when backend rejects body",
    );
  });

  console.log("  ✓ publishDesignStorePack: backend error surfaces as exception");
}

async function run() {
  console.log("▶ Running Design Store client API helper tests…");

  await testListDesignStorePacksSuccess();
  await testListDesignStorePacksBackendError();
  await testListDesignStorePacksNetworkError();
  await testGetDesignStorePackSuccess();
  await testGetDesignStorePack404ReturnsNull();
  await testPublishDesignStorePackSuccess();
  await testPublishDesignStorePackBackendError();

  console.log("✅ All Design Store client API helper tests passed.");
}

run().catch((err) => {
  console.error("❌ Design Store client API helper tests failed.");
  console.error(err);
  process.exit(1);
});
