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

echo
echo "• Instant spec continuity"
resp1="$(curl -s -X POST "$AI/instant" \
  -H 'content-type: application/json' \
  -H 'x-ship-preview: 1' \
  --data '{"prompt":"sanity","sessionId":"deep"}')"

specId1="$(jq -r '.spec.id' <<<"$resp1")"
pageId1="$(jq -r '.result.pageId' <<<"$resp1")"

resp2="$(curl -s -X POST "$AI/instant" \
  -H 'content-type: application/json' \
  -H 'x-ship-preview: 1' \
  --data '{"prompt":"sanity","sessionId":"deep"}')"

specId2="$(jq -r '.spec.id' <<<"$resp2")"

if [ -z "$specId1" ] || [ "$specId1" = "null" ]; then
  echo "  ❌ no specId from first /instant"; exit 1
fi
if [ "$specId1" != "$specId2" ]; then
  echo "  ❌ spec id changed across identical calls ($specId1 → $specId2)"; exit 1
fi
echo "  ✅ spec continuity ($specId1)"

echo
echo "• OG present"
if curl -s "$AI/previews/$specId1" | grep -qi 'og:title'; then
  echo "  ✅ OG present (specId)"
elif [ -n "$pageId1" ] && [ "$pageId1" != "null" ] && curl -s "$AI/previews/$pageId1" | grep -qi 'og:title'; then
  echo "  ✅ OG present (pageId)"
else
  echo "  ❌ OG meta not found"; exit 1
fi

echo
echo "========================="
echo " Deep verification: PASS"
echo "========================="
