#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:5050}"
AI="$API/api/ai"

fail(){ echo "❌ $*"; exit 1; }
pass(){ echo "✅ $*"; }

# 1) ping + strict-proof guardrail
curl -sf "$AI/instant?goal=ping" >/dev/null || fail "instant ping failed"
curl -s -X POST "$AI/one" -H 'x-proof-strict: 1' -H 'content-type: application/json' \
  --data '{"prompt":"#1 with 200% growth and 10x","sessionId":"can1"}' \
  | jq -e '.result.error=="proof_gate_fail"' >/dev/null || fail "strict proof failed"
pass "core endpoints healthy"

# 2) quick ship + metrics move
B1=$(curl -s "$AI/metrics" | jq '.url_costs.pages')
curl -s -X POST "$AI/instant" -H 'content-type: application/json' \
  --data '{"prompt":"canary ship","sessionId":"can2"}' >/dev/null || fail "instant ship failed"
B2=$(curl -s "$AI/metrics" | jq '.url_costs.pages')
[ "$B2" -ge "$B1" ] || fail "metrics did not move"
pass "metrics monotonic"

echo "=== Canary OK ==="
