// server/sup/contracts.verify.ts

// Thin bridge so SUP / contracts guard can share the same
// verifyAndPrepare implementation as the DSL contracts.
//
// We intentionally re-export from the existing AI DSL module
// so there is a single source of truth for contracts logic.

export { verifyAndPrepare } from "../intent/dsl.ts";
