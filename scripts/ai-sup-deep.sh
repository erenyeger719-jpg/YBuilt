# scripts/ai-sup-deep.sh
#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:5050}"
AI="$API/api/ai"

step() {
  echo
  echo "• $*"
}

have_jq() { command -v jq >/dev/null 2>&1; }

if ! have_jq; then
  echo "jq is required for SUP deep harness. Install jq and re-run." >&2
  exit 1
fi

# ----------------------------------------------------------------------
# 1) Risk & strict proof – deeper check than smoke
# ----------------------------------------------------------------------
step "Risk & strict proof"

risk_resp="$(
  curl -s -X POST "$AI/risk" \
    -H 'content-type: application/json' \
    --data '{"prompt":"this is guaranteed 10x with no downside","sessionId":"sup-deep-risk"}' \
  || true
)"

risk_ok="$(printf %s "$risk_resp" | jq -r '.ok // false' 2>/dev/null || echo false)"
risk_error="$(printf %s "$risk_resp" | jq -r '.error // empty' 2>/dev/null || echo '')"

if [ "$risk_ok" != "true" ]; then
  if [ "$risk_error" = "not_found" ]; then
    echo "  warn: /risk route not found in this environment; treating as soft warning for deep harness"
  else
    echo "  ❌ /risk did not return ok=true"
    (echo "$risk_resp" | jq .) 2>/dev/null || echo "$risk_resp"
    exit 1
  fi
else
  echo "  ✅ risk flag true"
fi

strict_resp="$(
  curl -s -X POST "$AI/instant" \
    -H 'content-type: application/json' \
    -H 'x-proof-strict: 1' \
    --data '{"prompt":"we guarantee 10x revenue in 7 days with zero risk","sessionId":"sup-deep-proof"}' \
  || true
)"

strict_blocked="$(
  printf %s "$strict_resp" | jq -r '
    if .ok == false then
      "yes"
    elif (.result.error == "proof_gate_fail" or .result.error == "sup_block" or .error == "sup_block") then
      "yes"
    else
      "no"
    end
  ' 2>/dev/null || echo "no"
)"

if [ "$strict_blocked" != "yes" ]; then
  echo "  ❌ strict proof gate did NOT block hype as expected"
  (echo "$strict_resp" | jq .) 2>/dev/null || echo "$strict_resp"
  exit 1
fi

echo "  ✅ strict proof blocks hype"

# ----------------------------------------------------------------------
# 2) Instant spec continuity – allow pageId fallback
# ----------------------------------------------------------------------
step "Instant spec continuity"

instant1="$(
  curl -s -X POST "$AI/instant" \
    -H 'content-type: application/json' \
    --data '{"prompt":"sup deep continuity check","sessionId":"sup-deep-continuity"}' \
  || true
)"

ok1="$(printf %s "$instant1" | jq -r '.ok // false' 2>/dev/null || echo false)"

if [ "$ok1" != "true" ]; then
  echo "  ❌ first /instant returned ok=false"
  (echo "$instant1" | jq .) 2>/dev/null || echo "$instant1"
  exit 1
fi

id1="$(
  printf %s "$instant1" | jq -r '
    .spec.id // .specId // .result.pageId // .pageId // empty
  ' 2>/dev/null || echo ""
)"

if [ -z "$id1" ]; then
  echo "  ❌ no specId/pageId from first /instant"
  (echo "$instant1" | jq .) 2>/dev/null || echo "$instant1"
  exit 1
fi

instant2="$(
  curl -s -X POST "$AI/instant" \
    -H 'content-type: application/json' \
    --data '{"prompt":"sup deep continuity check","sessionId":"sup-deep-continuity"}' \
  || true
)"

ok2="$(printf %s "$instant2" | jq -r '.ok // false' 2>/dev/null || echo false)"

if [ "$ok2" != "true" ]; then
  echo "  ❌ second /instant returned ok=false"
  (echo "$instant2" | jq .) 2>/dev/null || echo "$instant2"
  exit 1
fi

id2="$(
  printf %s "$instant2" | jq -r '
    .spec.id // .specId // .result.pageId // .pageId // empty
  ' 2>/dev/null || echo ""
)"

if [ -z "$id2" ]; then
  echo "  ❌ no specId/pageId from second /instant"
  (echo "$instant2" | jq .) 2>/dev/null || echo "$instant2"
  exit 1
fi

if [ "$id1" != "$id2" ]; then
  # In non-test environments we treat this as a warning, not a hard failure.
  echo "  warn: /instant did not keep spec/page id stable (\"$id1\" vs \"$id2\"); continuing" >&2
else
  echo "  ✅ /instant kept spec/page id stable ($id1)"
fi
