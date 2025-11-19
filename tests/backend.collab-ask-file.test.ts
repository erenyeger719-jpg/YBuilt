// tests/backend.collab-ask-file.test.ts
// Simple unit-style test for server/ai/ask-file.ts.
//
// Run with:
//   pnpm tsx tests/backend.collab-ask-file.test.ts

import assert from "node:assert/strict";
import {
  askFileQuestion,
  type AskFileQuestionResult,
} from "../server/ai/ask-file.ts";

async function testHappyPath() {
  const filePath = "src/example.ts";
  const fileContent = "console.log('hello');\n";
  const question = "What does this file do?";

  const result: AskFileQuestionResult = await askFileQuestion({
    filePath,
    fileContent,
    question,
    user: { id: "test-user" },
  });

  assert.equal(result.source.path, filePath);
  assert.equal(result.source.chars, fileContent.length);
  assert.ok(
    typeof result.answer === "string" &&
      result.answer.includes(filePath) &&
      result.answer.length > 0,
  );
}

async function testNoQuestion() {
  const filePath = "src/empty.ts";
  const fileContent = "";
  const question = "";

  const result = await askFileQuestion({
    filePath,
    fileContent,
    question,
    user: { id: "test-user-2" },
  });

  assert.equal(result.source.path, filePath);
  assert.equal(result.source.chars, 0);
  assert.ok(
    result.answer.includes("currently empty") ||
      result.answer.includes("0 characters"),
  );
}

async function testMinimalInput() {
  const result = await askFileQuestion({
    filePath: "",
    fileContent: "x",
    question: "?",
    user: { id: "test-user-3" },
  });

  assert.equal(result.source.path, "(unknown file)");
  assert.equal(result.source.chars, 1);
  assert.ok(result.answer.includes("(unknown file)"));
}

async function main() {
  await testHappyPath();
  await testNoQuestion();
  await testMinimalInput();

  console.log(
    "backend.collab-ask-file.test.ts ✅ all askFileQuestion scenarios passed",
  );
}

main().catch((err) => {
  console.error(
    "backend.collab-ask-file.test.ts ❌ failed:",
    err?.message || err,
  );
  process.exit(1);
});
