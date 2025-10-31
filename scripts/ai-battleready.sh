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

bootstrap_dirs(){
  # Ensure all expected write targets exist after cleanup
  mkdir -p \
    .cache \
    .cache/specs \
    .cache/proof \
    .cache/vectors \
    .cache/sections \
    .cache/prior \
    previews \
    previews/pages \
    data/logs \
    data/tmp || true
}

probe(){
  # Run a curl; if ok!=true, dump body (to stderr) and exit
  local name="$1"; shift
  local out
  out="$(eval "$*" || true)"
  local ok
  ok="$(printf %s "$out" | jq -r '.ok // false' 2>/dev/null || echo false)"
  if [ "$ok" != "true" ]; then
    echo "❌ $name failed. Body:" >&2
    (echo "$out" | jq .) 1>&2 2>/dev/null || echo "$out" >&2
    exit 1
  fi
}

ensure_logo_vectors(){
  # Seed until 'logo' has at least 1 hit (max 20 tries)
  for ((i=1;i<=20;i++)); do
    local cnt
    cnt="$(curl -s "$AI/vectors/search?q=logo" | jq '.items | length' 2>/dev/null || echo 0)"
    if [ "${cnt:-0}" -gt 0 ]; then return 0; fi
    probe "vectors/seed" \
      "curl -s -X POST '$AI/vectors/seed' -H 'content-type: application/json' --data '{\"count\":8}'"
    sleep 0.15
  done
  echo "warn: logo search still empty after aggressive seeding; continuing" >&2
}

ship_until_preview_and_page(){
  # Try up to 12 times for ok=true + pageId + preview path/url
  local last_ok_pid=""
  local R
  for ((i=1;i<=12;i++)); do
    R="$(curl -s -X POST "$AI/instant" \
      -H 'content-type: application/json' \
      -H 'x-ship-preview: 1' \
      --data '{"prompt":"warm vitest","sessionId":"vt1"}' || true)"
    local OK PID PREVIEW_PATH URL_VAL
    OK="$(printf %s "$R" | jq -r '.ok // false' 2>/dev/null || echo false)"
    PID="$(printf %s "$R" | jq -r '(.result.pageId // .pageId // empty)' 2>/dev/null || true)"
    PREVIEW_PATH="$(printf %s "$R" | jq -r '(.result.path // empty)' 2>/dev/null || true)"
    URL_VAL="$(printf %s "$R" | jq -r '(.url // empty)' 2>/dev/null || true)"

    if [ "$OK" = "true" ] && [ -n "$PID" ]; then last_ok_pid="$PID"; fi
    if [ "$OK" = "true" ] && [ -n "$PID" ] && { [ -n "$PREVIEW_PATH" ] || [ -n "$URL_VAL" ]; }; then
      curl -s "$AI/proof/$PID" >/dev/null || true
      echo "$PID"        # stdout only on success
      return 0
    fi
    sleep 0.15
  done

  # Failure path: print diagnostics to STDERR only; print NOTHING to stdout
  echo "❌ instant warm never produced a preview. Last server response:" >&2
  (echo "$R" | jq .) 1>&2 2>/dev/null || echo "$R" >&2
  return 1
}

ensure_metrics_pages(){
  # Ensure metrics.url_costs.pages ≥ 1. If not, force one convert on PID.
  local pid="${1:-}"
  for ((i=1;i<=20;i++)); do
    local M ok pages
    M="$(curl -s "$AI/metrics" || echo '{}')"
    ok="$(printf %s "$M" | jq -r '.ok' 2>/dev/null || echo false)"
    pages="$(printf %s "$M" | jq -r '.url_costs.pages // 0' 2>/dev/null || echo 0)"
    if [ "$ok" = "true" ] && [ "${pages:-0}" -ge 1 ]; then
      return 0
    fi
    if [ -n "$pid" ]; then
      curl -s -X POST "$AI/kpi/convert" -H 'content-type: application/json' \
        --data "{\"pageId\":\"$pid\"}" >/dev/null || true
    fi
    sleep 0.15
  done
  echo "warn: metrics pages still 0 after convert attempts; continuing" >&2
}

warm(){
  # Clean baseline, then immediately recreate write targets
  rm -rf .cache || true
  bootstrap_dirs

  # Seed vectors early (fail fast if broken)
  probe "vectors/seed" \
    "curl -s -X POST '$AI/vectors/seed' -H 'content-type: application/json' --data '{\"count\":12}'"

  ensure_logo_vectors

  # Ship a real page and nudge proof (hard fail if no PID)
  local PID
  if ! PID="$(ship_until_preview_and_page)"; then
    echo "❌ warm failed to produce pageId; aborting pre-vitest." >&2
    exit 1
  fi

  # Make metrics reflect at least one page
  ensure_metrics_pages "$PID"
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
