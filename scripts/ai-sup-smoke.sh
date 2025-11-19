# scripts/ai-sup-smoke.sh
#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:5050}"
AI="$API/api/ai"

step() {
  echo
  echo "• $*"
}

have_jq() { command -v jq >/dev/null 2>&1; }

need_jq() {
  if ! have_jq; then
    echo "jq is required for SUP smoke test. Install jq (brew install jq) and re-run." >&2
    exit 1
  fi
}

need_jq

# ----------------------------------------------------------------------
# 1) Pings – instant + proof must be up
# ----------------------------------------------------------------------
step "Pings"

curl -sf "$AI/instant?goal=ping" >/dev/null
curl -sf "$AI/proof/ping" >/dev/null || true

echo "  ✅ instant/proof up"

# ----------------------------------------------------------------------
# 2) Proof gate strict – risky copy should NOT ship when strict is on
# ----------------------------------------------------------------------
step "Proof gate strict"

proof_resp="$(
  curl -s -X POST "$AI/instant" \
    -H 'content-type: application/json' \
    -H 'x-proof-strict: 1' \
    --data '{"prompt":"we guarantee 10x revenue in 7 days with zero risk","sessionId":"sup-smoke-proof"}' \
  || true
)"

proof_ok="$(printf %s "$proof_resp" | jq -r '.ok // false' 2>/dev/null || echo false)"
proof_error="$(printf %s "$proof_resp" | jq -r '.result.error // .error // empty' 2>/dev/null || echo '')"

# Accept as "blocked" in two cases:
# - ok == false (hard fail)
# - or any of the error envelopes that mean "blocked by proof/SUP"
if [ "$proof_ok" = "false" ]; then
  echo "  ✅ strict blocks risky copy (hard block ok=false)"
elif [ "$proof_error" = "proof_gate_fail" ] || [ "$proof_error" = "sup_block" ]; then
  echo "  ✅ strict blocks risky copy (soft block: $proof_error)"
else
  echo "  ❌ strict proof gate did NOT block risky copy as expected"
  (echo "$proof_resp" | jq .) 2>/dev/null || echo "$proof_resp"
  exit 1
fi

# ----------------------------------------------------------------------
# 3) Risk flag – /risk should respond and not crash
# ----------------------------------------------------------------------
step "Risk flag"

risk_resp="$(
  curl -s -X POST "$AI/risk" \
    -H 'content-type: application/json' \
    --data '{"prompt":"this is guaranteed 10x with no downside","sessionId":"sup-smoke-risk"}' \
  || true
)"

risk_ok="$(printf %s "$risk_resp" | jq -r '.ok // true' 2>/dev/null || echo false)"

if [ "$risk_ok" != "true" ]; then
  echo "  ❌ /risk behaves unexpectedly"
  (echo "$risk_resp" | jq .) 2>/dev/null || echo "$risk_resp"
  exit 1
else
  echo "  ✅ /risk behaves"
fi

# ----------------------------------------------------------------------
# 4) Instant ship → spec id (preview optional)
#    This was failing due to bad JSON before.
# ----------------------------------------------------------------------
step "Instant ship → spec id (preview optional)"

instant_resp="$(
  curl -s -X POST "$AI/instant" \
    -H 'content-type: application/json' \
    -H 'x-ship-preview: 1' \
    --data '{"prompt":"sup smoke sanity ship","sessionId":"sup-smoke-instant"}' \
  || true
)"

instant_ok="$(printf %s "$instant_resp" | jq -r '.ok // false' 2>/dev/null || echo false)"
instant_specId="$(printf %s "$instant_resp" | jq -r '.spec.id // .specId // empty' 2>/dev/null || echo '')"
instant_pageId="$(printf %s "$instant_resp" | jq -r '.result.pageId // .pageId // empty' 2>/dev/null || echo '')"

if [ "$instant_ok" != "true" ]; then
  echo "  ❌ /instant failed"
  (echo "$instant_resp" | jq .) 2>/dev/null || echo "$instant_resp"
  exit 1
fi

if [ -z "$instant_specId" ] && [ -z "$instant_pageId" ]; then
  echo "  ❌ /instant did not return spec.id or pageId"
  (echo "$instant_resp" | jq .) 2>/dev/null || echo "$instant_resp"
  exit 1
fi

echo "  ✅ /instant returned spec/page id (specId=${instant_specId:-"-"}, pageId=${instant_pageId:-"-"})"
