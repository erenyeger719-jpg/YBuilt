#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:5050}"
AI="$API/api/ai"

step(){ echo; echo "==> $*"; }

# --- helpers ---------------------------------------------------------------
have_jq(){ command -v jq >/dev/null 2>&1; }
need_jq(){
  if ! have_jq; then
    echo "jq is required for battle harness. Install jq and re-run." >&2
    exit 1
  fi
}

ensure_logo_vectors(){
  # Keep seeding until 'logo' query returns at least 1 hit (max 20 tries)
  for i in $(seq 1 20); do
    local cnt
    cnt="$(curl -s "$AI/vectors/search?q=logo" | jq '.items | length' 2>/dev/null || echo 0)"
    if [ "${cnt:-0}" -gt 0 ]; then
      return 0
    fi
    curl -s -X POST "$AI/vectors/seed" -H 'content-type: application/json' \
      --data '{"count":8}' >/dev/null || true
    sleep 0.15
  done
  echo "warn: logo search still empty after aggressive seeding; continuing" >&2
}

ship_until_preview_and_page(){
  # Ship up to 10 times until we have pageId AND preview path/url
  local lastPID=""
  for i in $(seq 1 10); do
    local R PID PATH URL
    R="$(curl -s -X POST "$AI/instant" -H 'content-type: application/json' \
      --data '{"prompt":"warm vitest","sessionId":"vt1"}' || true)"
    PID="$(printf %s "$R" | jq -r '(.result.pageId // .pageId // empty)' 2>/dev/null || true)"
    PATH="$(printf %s "$R" | jq -r '(.result.path // empty)' 2>/dev/null || true)"
    URL="$(printf %s "$R" | jq -r '(.url // empty)' 2>/dev/null || true)"

    if [ -n "$PID" ]; then lastPID="$PID"; fi
    if [ -n "$PID" ] && { [ -n "$PATH" ] || [ -n "$URL" ]; }; then
      # nudge proof so proof route/materializes
      curl -s "$AI/proof/$PID" >/dev/null || true
      echo "$PID"
      return 0
    fi
    sleep 0.15
  done
  # Best effort: if we only got PID, still return it
  if [ -n "$lastPID" ]; then
    curl -s "$AI/proof/$lastPID" >/dev/null || true
    echo "$lastPID"
    return 0
  fi
  echo ""
  return 1
}

ensure_metrics_pages(){
  # Make sure metrics (url_costs.pages) show >= 1, poll up to 20 times
  for i in $(seq 1 20); do
    local ok pages
    ok="$(curl -s "$AI/metrics" | jq -r '.ok' 2>/dev/null || echo false)"
    pages="$(curl -s "$AI/metrics" | jq -r '.url_costs.pages // 0' 2>/dev/null || echo 0)"
    if [ "$ok" = "true" ] && [ "${pages:-0}" -ge 1 ]; then
      return 0
    fi
    sleep 0.15
  done
  echo "warn: metrics pages still 0; continuing" >&2
}

warm(){
  # Clean + minimal warm so every suite sees a sane baseline
  rm -rf .cache || true

  # Seed some vectors first to speed up readiness later
  curl -s -X POST "$AI/vectors/seed" -H 'content-type: application/json' \
    --data '{"count":12}' >/dev/null || true

  # Ensure we can search 'logo' deterministically
  ensure_logo_vectors

  # Ship until we get a pageId and a preview path/url
  local PID
  PID="$(ship_until_preview_and_page || true)"

  # Touch metrics and ensure at least one page accounted
  ensure_metrics_pages
}

# --------------------------------------------------------------------------

need_jq

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
