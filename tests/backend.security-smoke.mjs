// tests/backend.security-smoke.mjs
// Security sanity checks for core backend endpoints.
//
// Goal: throw weird / hostile inputs at a few endpoints and assert:
// - No 5xx responses.
// - Over-long / obviously bad inputs get 4xx, not 2xx/5xx.
//
// Usage:
//   BASE_URL=http://localhost:5050 npm run smoke:security:backend

import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL || "http://localhost:5050";

async function requestRaw(path, init = {}) {
  const url = BASE_URL + path;
  const res = await fetch(url, { ...init });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // best-effort only
  }
  return { res, text, json };
}

function assertNo5xx(label, res, bodySnippet) {
  if (res.status >= 500) {
    throw new Error(
      `${label}: unexpected 5xx (${res.status}) body=${bodySnippet}`
    );
  }
}

async function testExecuteTooLongCode() {
  console.log("[security] execute: over-long code payload");

  // Intentionally exceed the 50k character limit we enforce in the API.
  const tooLongCode =
    "console.log('ybuilt security smoke: overlong payload');\n" +
    "x".repeat(60000);

  const { res, text, json } = await requestRaw("/api/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Mark as pro so quota middleware doesn't interfere with this test.
      "x-plan": "pro"
    },
    body: JSON.stringify({ code: tooLongCode })
  });

  const snippet = text.slice(0, 200);
  assertNo5xx("execute over-long", res, snippet);

  // For an obviously invalid payload we EXPECT a 4xx, not success.
  assert.ok(
    res.status >= 400 && res.status < 500,
    `expected 4xx for over-long code, got ${res.status} body=${snippet}`
  );

  // If the API uses a structured error, sanity-check it.
  if (json && typeof json === "object") {
    if ("ok" in json) {
      assert.notEqual(json.ok, true, "over-long code should not be ok=true");
    }
  }
}

async function testExecuteWeirdContent() {
  console.log("[security] execute: weird but valid code payload");

  const weirdCode = `
    // Try to confuse the sandbox with traversal-ish strings.
    const paths = ["../../etc/passwd", "..\\\\..\\\\windows\\\\system32"];
    console.log("ybuilt security smoke: weird content", paths.join(","));
    "ok";
  `;

  const { res, text, json } = await requestRaw("/api/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-plan": "pro"
    },
    body: JSON.stringify({ code: weirdCode })
  });

  const snippet = text.slice(0, 200);
  assertNo5xx("execute weird content", res, snippet);

  // Here we don't strictly care if it's 2xx or 4xx, we just care that it
  // doesn't explode the server. But if it's 2xx, sanity-check shape.
  if (res.ok && json && typeof json === "object") {
    if ("status" in json) {
      assert.notEqual(
        json.status,
        "error",
        `weird content should not result in status="error" without explanation. body=${snippet}`
      );
    }
  }
}

async function testExecuteGarbageJson() {
  console.log("[security] execute: malformed JSON body");

  const { res, text } = await requestRaw("/api/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-plan": "pro"
    },
    // Intentionally broken JSON.
    body: '{"code": "console.log(\\"bad json\\"}"'
  });

  const snippet = text.slice(0, 200);
  assertNo5xx("execute malformed json", res, snippet);

  // Malformed JSON should be rejected as 4xx.
  assert.ok(
    res.status >= 400 && res.status < 500,
    `expected 4xx for malformed JSON, got ${res.status} body=${snippet}`
  );
}

async function testLogsRecentWithHugeLimit() {
  console.log("[security] logs.recent: huge limit and junk query params");

  const { res, text, json } = await requestRaw(
    "/api/logs/recent?limit=100000&foo=../../etc/passwd"
  );

  const snippet = text.slice(0, 200);
  assertNo5xx("logs.recent huge limit", res, snippet);

  // This endpoint should clamp limit and still behave normally.
  assert.ok(
    res.ok,
    `expected 2xx for logs.recent huge limit (with internal clamping), got ${res.status} body=${snippet}`
  );

  if (json && typeof json === "object") {
    const items = Array.isArray(json.items) ? json.items : [];
    assert.ok(
      items.length <= 500,
      `logs.recent should clamp limit to <= 500, got items.length=${items.length}`
    );
  }
}

async function main() {
  console.log(`[security] BASE_URL=${BASE_URL}`);

  await testExecuteTooLongCode();
  await testExecuteWeirdContent();
  await testExecuteGarbageJson();
  await testLogsRecentWithHugeLimit();

  console.log("[security] backend security smoke tests DONE");
}

main().catch((err) => {
  console.error("[security] FATAL ERROR", err);
  process.exit(1);
});
