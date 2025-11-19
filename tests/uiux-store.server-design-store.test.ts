// tests/uiux-store.server-design-store.test.ts
// Simple TS test runner for Design Store backend API.
// Run with: pnpm tsx tests/uiux-store.server-design-store.test.ts
//
// Requires your server to be running on http://localhost:5050
// (or set BASE_URL env var).

import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL || "http://localhost:5050";

async function getJson(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Expected JSON from ${path}, got non-JSON response:\n${text.slice(0, 200)}`,
    );
  }

  return { res, json };
}

async function postJson(path: string, body: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Expected JSON from POST ${path}, got non-JSON response:\n${text.slice(
        0,
        200,
      )}`,
    );
  }

  return { res, json };
}

async function testListEndpointBasic() {
  const { res, json } = await getJson("/api/design-store/list");

  assert.equal(
    res.status,
    200,
    `GET /api/design-store/list should return 200, got ${res.status}`,
  );

  assert.equal(
    json.ok,
    true,
    `Expected { ok: true } from /api/design-store/list, got ${JSON.stringify(json)}`,
  );

  assert.ok(
    Array.isArray(json.items),
    `Expected items to be an array, got: ${JSON.stringify(json.items)}`,
  );

  console.log(
    `  • /api/design-store/list returned ${json.items.length} item(s)`,
  );

  return json.items as any[];
}

async function testListEndpointFiltersBySlotHero() {
  const { res, json } = await getJson("/api/design-store/list?slot=hero");

  assert.equal(
    res.status,
    200,
    `GET /api/design-store/list?slot=hero should return 200, got ${res.status}`,
  );

  assert.equal(
    json.ok,
    true,
    `Expected ok:true from /api/design-store/list?slot=hero, got ${JSON.stringify(
      json,
    )}`,
  );

  assert.ok(
    Array.isArray(json.items),
    `Expected items array from /api/design-store/list?slot=hero, got: ${JSON.stringify(
      json.items,
    )}`,
  );

  if (json.items.length > 0) {
    for (const item of json.items) {
      assert.equal(
        item.slot,
        "hero",
        `Expected item.slot === "hero" for filtered list, got ${item.slot}`,
      );
    }
  }

  console.log(
    `  • /api/design-store/list?slot=hero returned ${json.items.length} hero item(s)`,
  );
}

async function testListEndpointFiltersByQueryPricing() {
  const { res, json } = await getJson("/api/design-store/list?q=pricing");

  assert.equal(
    res.status,
    200,
    `GET /api/design-store/list?q=pricing should return 200, got ${res.status}`,
  );

  assert.equal(
    json.ok,
    true,
    `Expected ok:true from /api/design-store/list?q=pricing, got ${JSON.stringify(
      json,
    )}`,
  );

  assert.ok(
    Array.isArray(json.items),
    `Expected items array from /api/design-store/list?q=pricing, got: ${JSON.stringify(
      json.items,
    )}`,
  );

  console.log(
    `  • /api/design-store/list?q=pricing returned ${json.items.length} item(s)`,
  );
}

async function testPackEndpointForExistingIdIfAny(items: any[]) {
  if (!items.length) {
    console.log(
      "  • No packs in list, skipping existing-pack GET test (this is OK for now)",
    );
    return null;
  }

  const first = items[0];
  const id = first.id;

  const { res, json } = await getJson(
    `/api/design-store/pack/${encodeURIComponent(id)}`,
  );

  assert.equal(
    res.status,
    200,
    `GET /api/design-store/pack/:id should return 200 for existing id, got ${res.status}`,
  );

  assert.equal(
    json.ok,
    true,
    `Expected { ok: true } for existing pack, got ${JSON.stringify(json)}`,
  );

  // Be flexible about response shape:
  // - { ok:true, pack: {...} }
  // - { ok:true, item: {...} }
  // - { ok:true, design: {...} }
  // - { ok:true, id: "...", slot: "...", ... }
  const pack =
    json.pack ??
    json.item ??
    json.design ??
    (json.id ? json : null);

  assert.ok(
    pack,
    `Expected a pack object in response (pack/item/design or root), got: ${JSON.stringify(
      json,
    )}`,
  );

  assert.equal(
    pack.id,
    id,
    `Expected pack.id to be ${id}, got ${pack.id}`,
  );

  console.log(
    `  • /api/design-store/pack/${id} returned a pack with matching id`,
  );

  // Return full pack so we can use it as a publish template
  return pack;
}

async function testPackEndpointForMissingId() {
  const missingId = "__ybuilt_does_not_exist__";

  const { res, json } = await getJson(
    `/api/design-store/pack/${encodeURIComponent(missingId)}`,
  );

  // Accept either:
  // - 404 with JSON error
  // - 200 with { ok: false, error: "not_found" }
  assert.ok(
    res.status === 404 || res.status === 200,
    `Expected 404 or 200 for missing id, got ${res.status}`,
  );

  assert.ok(
    json && typeof json === "object",
    `Expected JSON body for missing id, got: ${JSON.stringify(json)}`,
  );

  console.log(
    `  • /api/design-store/pack (missing id) returned status ${res.status} with JSON body`,
  );
}

async function testPublishEndpointUsingExistingTemplate(
  template: any | null,
  listItems: any[],
) {
  if (!template && !listItems.length) {
    console.log(
      "  • No packs available at all, skipping publish test",
    );
    return;
  }

  const base = template ?? listItems[0];
  const baseId = String(base.id || "ybuilt-pack");
  const newId = `${baseId}__publish_test_${Date.now()}`;

  const body = {
    ...base,
    id: newId,
    name: `${base.name || "Publish test pack"} (publish test)`,
  };

  const { res, json } = await postJson("/api/design-store/publish", body);

  assert.ok(
    res.status === 200 || res.status === 201,
    `Expected 200 or 201 from POST /api/design-store/publish, got ${res.status} with body: ${JSON.stringify(
      json,
    )}`,
  );

  assert.ok(
    json && typeof json === "object",
    `Expected JSON body from publish, got: ${JSON.stringify(json)}`,
  );

  if ("ok" in json) {
    assert.equal(
      json.ok,
      true,
      `Expected ok:true from publish, got: ${JSON.stringify(json)}`,
    );
  }

  // Confirm the new pack shows up in the list
  const { json: listJson } = await getJson("/api/design-store/list");
  assert.ok(
    Array.isArray(listJson.items),
    `Expected items array from list after publish, got: ${JSON.stringify(
      listJson.items,
    )}`,
  );

  const found = listJson.items.find((p: any) => p.id === newId);

  assert.ok(
    found,
    `Expected to see newly published pack with id=${newId} in list, but it was not found`,
  );

  console.log(
    `  • POST /api/design-store/publish created new pack id=${newId} visible in list`,
  );
}

async function testPublishEndpointRejectsBadBody() {
  const badBody = {
    // Deliberately missing required fields like slot/specPatch/etc.
    id: "__ybuilt_invalid_publish__",
  };

  const { res, json } = await postJson("/api/design-store/publish", badBody);

  assert.ok(
    res.status >= 400 && res.status < 500,
    `Expected 4xx from POST /api/design-store/publish with bad body, got ${res.status} with body: ${JSON.stringify(
      json,
    )}`,
  );

  console.log(
    `  • POST /api/design-store/publish rejected bad body with ${res.status}`,
  );
}

async function run() {
  console.log("▶ Running Design Store backend API tests…");
  console.log(`  BASE_URL = ${BASE_URL}`);

  const items = await testListEndpointBasic();
  await testListEndpointFiltersBySlotHero();
  await testListEndpointFiltersByQueryPricing();
  const fullPack = await testPackEndpointForExistingIdIfAny(items);
  await testPackEndpointForMissingId();
  await testPublishEndpointUsingExistingTemplate(fullPack, items);
  await testPublishEndpointRejectsBadBody();

  console.log("✅ All Design Store backend API tests passed.");
}

run().catch((err) => {
  console.error("❌ Design Store backend API tests failed.");
  console.error(err);
  process.exit(1);
});
