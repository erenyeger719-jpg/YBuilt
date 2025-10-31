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

# 2) SUP suite: smoke → deep → chaos
step "SUP smoke"
bash scripts/ai-sup-smoke.sh
step "SUP deep"
bash scripts/ai-sup-deep.sh
step "SUP chaos"
bash scripts/ai-sup-chaos.sh

# 3) Vitest: scenarios + contracts + invariants + resilience + race
step "Vitest suite"
npx vitest run \
  server/tests/ai.scenarios.test.ts \
  server/tests/ai.contracts.test.ts \
  server/tests/ai.invariants.test.ts \
  server/tests/ai.resilience.test.ts \
  server/tests/ai.race.test.ts \
  --pool=threads

echo
echo "===================="
echo " BATTLE CHECK: PASS"
echo "===================="
