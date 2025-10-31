#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:5050}"
AI="$API/api/ai"

section(){ echo; echo "• $*"; }
ok(){ echo "  ✅ $*"; }
die(){ echo "  ❌ $*"; exit 1; }
assert(){ local msg="$1"; shift; bash -lc "set -euo pipefail; $*" >/dev/null && ok "$msg" || die "$msg"; }

section "Risk & strict proof"

# Encode the prompt to avoid shell/URL parsing issues that lead to non-JSON
RISK_URL="$AI/risk?prompt=%231+tool+with+200%25+growth+and+10x+impact"
assert "risk flag true" "curl -s '$RISK_URL' | jq -er '.risky==true'"

assert "strict proof blocks hype" \
"curl -s -X POST '$AI/one' -H 'x-proof-strict: 1' -H 'content-type: application/json' \
 --data '{\"prompt\":\"#1 with 200% growth and 10x ROI\",\"sessionId\":\"deep1\"}' | jq -er '.result.error==\"proof_gate_fail\"'"

section "Instant spec continuity"

RESP=$(curl -s -X POST "$AI/instant?__test=1" -H 'x-test: 1' -H 'content-type: application/json' \
 --data '{"prompt":"founders dark waitlist","sessionId":"deep2"}')

# Require a spec id; preview is optional
SPEC_ID=$(printf %s "$RESP" | jq -r '.spec.id // empty')
[ -n "$SPEC_ID" ] || die "no spec id"

# If preview exists, do sanity checks; else move on
URL=$(printf %s "$RESP" | jq -r '.url // .result.path // empty')
if [ -n "$URL" ]; then
  HTML="$(curl -s "$API$URL")"
  assert "OG present" "printf %s \"$HTML\" | grep -q 'og:title'"
  assert "no <script> tags" "printf %s \"$HTML\" | grep -qi '<script' && exit 1 || exit 0"
else
  echo "  ℹ️ preview not persisted (ok)"
fi

echo
echo "========================="
echo " Deep verification: PASS"
echo "========================="
