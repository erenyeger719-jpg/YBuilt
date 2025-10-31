#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:5050}"
AI="$API/api/ai"

step(){ echo; echo "==> $*"; }
warm(){
  # Clean + minimal warm so every suite sees a sane baseline
  rm -rf .cache || true

  # 1) Ship once → warm previews/spec/proof paths
  local R
  R="$(curl -s -X POST "$AI/instant" -H 'content-type: application/json' \
    --data '{"prompt":"warm vitest","sessionId":"vt1"}' || true)"
  local PID
  PID="$(printf %s "$R" | jq -r '.result.pageId // empty' 2>/dev/null || true)"
  [ -n "${PID:-}" ] && curl -s "$AI/proof/$PID" >/dev/null || true

  # 2) Seed vectors so logo/search doesn’t hit empty index
  curl -s -X POST "$AI/vectors/seed" -H 'content-type: application/json' \
    --data '{"count":12}' >/dev/null || true

  # 3) Touch metrics so url_costs gets initialized
  curl -s "$AI/metrics" >/dev/null || true
}

# 0) Health ping
step "Health ping"
curl -sf "$AI/instant?goal=ping" >/dev/null

# 1) Canary
step "Canary"
bash scripts/ai-canary.sh

# 2) SUP smoke & deep (pre-chaos)
step "SUP smoke"
bash scripts/ai-sup-smoke.sh
step "SUP deep"
bash scripts/ai-sup-deep.sh

# 3) Clean + Warm before Vitest (avoid cold/flaky state)
step "Reset + Warm (pre-vitest)"
warm

# 4) Vitest — run files sequentially to avoid cross-file races
# (threads inside a file are fine; files themselves run one-by-one)
for f in \
  server/tests/ai.scenarios.test.ts \
  server/tests/ai.contracts.test.ts \
  server/tests/ai.invariants.test.ts \
  server/tests/ai.race.test.ts \
  server/tests/ai.resilience.test.ts
do
  step "Vitest: $f"
  npx vitest run "$f" --pool=threads
done

# 5) Chaos last, then cleanup & warm so dev stays clean
step "SUP chaos"
bash scripts/ai-sup-chaos.sh

step "Reset state after chaos"
warm

echo
echo "===================="
echo " BATTLE CHECK: PASS"
echo "===================="
