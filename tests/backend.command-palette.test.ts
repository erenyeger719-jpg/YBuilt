// tests/backend.command-palette.test.ts
// Simple tests for the command palette backend helper.
//
// These tests call handlePaletteCommand(...) directly instead of spinning
// up the HTTP server.
//
// Run with:
//   pnpm tsx tests/backend.command-palette.test.ts

import assert from "node:assert/strict";
import { handlePaletteCommand } from "../server/routes/tasks.js";

async function testHappyPathScaffold() {
  const result = await handlePaletteCommand({
    command: "scaffold_component",
    payload: { workspaceId: "ws_123" },
    user: { id: "user_1" },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.result.accepted, true);
  assert.equal(result.body.result.command, "scaffold_component");
  assert.equal(result.body.result.workspaceId, "ws_123");
}

async function testBadRequestMissingCommand() {
  const result = await handlePaletteCommand({
    // command missing / empty
    command: "",
    payload: {},
    user: { id: "user_2" },
  });

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, "bad_request");
}

async function testForbiddenWhenNoUser() {
  const result = await handlePaletteCommand({
    command: "scaffold_component",
    payload: { workspaceId: "ws_999" },
    // user is missing -> forbidden
    user: null as any,
  });

  assert.equal(result.statusCode, 403);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, "forbidden");
}

async function testUnknownCommand() {
  const result = await handlePaletteCommand({
    command: "this_does_not_exist",
    payload: { workspaceId: "ws_000" },
    user: { id: "user_3" },
  });

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, "unknown_command");
}

async function main() {
  await testHappyPathScaffold();
  await testBadRequestMissingCommand();
  await testForbiddenWhenNoUser();
  await testUnknownCommand();

  console.log(
    "backend.command-palette.test.ts ✅ all command palette scenarios passed",
  );
}

main().catch((err) => {
  console.error(
    "backend.command-palette.test.ts ❌ failed:",
    err?.message || err,
  );
  process.exit(1);
});
