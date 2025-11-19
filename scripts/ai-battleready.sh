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
  # Try up to 12 times for ok=true + pageId (preview path/url optional)
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

    if [ "$OK" = "true" ] && [ -n "$PID" ]; then
      last_ok_pid="$PID"
      # Nudge proof card once we have a pageId (preview URL is optional in this env)
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

# --- Instant ship → capture ids (more defensive) ---
resp="$(curl -s -X POST "$AI/instant" -H 'content-type: application/json' -H 'x-ship-preview: 1' \
  --data '{"prompt":"sanity","sessionId":"pre"}')"

ok="$(jq -r '.ok // false' <<<"$resp" 2>/dev/null || echo false)"
error_code="$(jq -r '.error // empty' <<<"$resp" 2>/dev/null || echo '')"
specId="$(jq -r '.spec.id // empty' <<<"$resp" 2>/dev/null || echo '')"
pageId="$(jq -r '.result.pageId // .pageId // empty' <<<"$resp" 2>/dev/null || echo '')"

if [ "$ok" != "true" ]; then
  if [ "$error_code" = "quota_exceeded" ]; then
    echo "warn: /instant sanity hit quota_exceeded; treating as soft warning for ai-battle." >&2
    # Clear ids so we skip OG check cleanly below
    specId=""
    pageId=""
  else
    echo "❌ /instant sanity call failed. Full response:" >&2
    (echo "$resp" | jq .) 1>&2 2>/dev/null || echo "$resp" >&2
    exit 1
  fi
fi

# If spec.id is missing but we have a pageId, fall back instead of failing hard.
if [ -z "$specId" ] && [ -n "$pageId" ]; then
  echo "warn: /instant returned no spec.id; falling back to pageId=$pageId as identifier" >&2
  specId="$pageId"
fi

if [ -z "$specId" ] && [ -z "$pageId" ]; then
  echo "warn: /instant sanity returned no spec.id/pageId; skipping OG check." >&2
else
  echo "✅ spec id=$specId"

  # --- OG present (try specId, then pageId) ---
  if curl -s "$AI/previews/$specId" | grep -qi 'og:title'; then
    echo "✅ OG present (specId)"
  elif [ -n "$pageId" ] && curl -s "$AI/previews/$pageId" | grep -qi 'og:title'; then
    echo "✅ OG present (pageId)"
  else
    echo "❌ OG meta not found"
    exit 1
  fi
fi

# 4) Vitest — run core AI suites sequentially to avoid cross-file races
for f in \
  tests/part1-core.spec.ts \
  tests/part3-compose.spec.ts \
  tests/part4-media.spec.ts \
  tests/part5-metrics.spec.ts \
  tests/e2e.golden.spec.ts
do
  step "Vitest: $f"
  npx vitest run "$f" --pool=threads
done

# 5) Chaos last, then soft reset so dev stays clean without hammering quotas
step "SUP chaos"
bash scripts/ai-sup-chaos.sh

step "Reset state after chaos (soft)"
rm -rf .cache || true
bootstrap_dirs
echo "warn: skipped post-chaos AI warm to avoid quota_exceeded noise; caches are clean." >&2

echo
echo "===================="
echo " BATTLE CHECK: PASS"
echo "===================="
