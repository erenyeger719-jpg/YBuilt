#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:5050}"
AI="$API/api/ai"

step(){ echo; echo "==> $*"; }

# 0) Health ping (fail fast if server isn't up)
step "Health ping"
curl -sf "$AI/instant?goal=ping" >/dev/null

# 1) Canary (core guardrails + counters monotonic)
step "Canary"
bash scripts/ai-canary.sh

# 2) SUP suite: smoke → deep  (run BEFORE chaos)
step "SUP smoke"
bash scripts/ai-sup-smoke.sh
step "SUP deep"
bash scripts/ai-sup-deep.sh

# 3) Vitest: scenarios + contracts + invariants + resilience + race  (clean state)
step "Vitest suite (pre-chaos)"
npx vitest run \
  server/tests/ai.scenarios.test.ts \
  server/tests/ai.contracts.test.ts \
  server/tests/ai.invariants.test.ts \
  server/tests/ai.resilience.test.ts \
  server/tests/ai.race.test.ts \
  --pool=threads

# 4) Chaos last (and then reset)
step "SUP chaos"
bash scripts/ai-sup-chaos.sh

step "Reset state after chaos (so dev env isn't left dirty)"
rm -rf .cache || true
# warm minimal state so metrics/proof don’t 404 on next dev run
curl -s -X POST "$AI/instant" -H 'content-type: application/json' \
  --data '{"prompt":"warm cache","sessionId":"warm1"}' >/dev/null || true
curl -s -X POST "$AI/vectors/seed" -H 'content-type: application/json' \
  --data '{"count":8}' >/dev/null || true

echo
echo "===================="
echo " BATTLE CHECK: PASS"
echo "===================="
