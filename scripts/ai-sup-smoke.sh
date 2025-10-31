#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:5050}"
AI="$API/api/ai"

section(){ echo; echo "• $*"; }
ok(){ echo "  ✅ $*"; }
die(){ echo "  ❌ $*"; exit 1; }
assert(){ local msg="$1"; shift; bash -lc "set -euo pipefail; $*" >/dev/null && ok "$msg" || die "$msg"; }

section "Pings"
assert "instant/proof up"  "curl -sf '$AI/instant?goal=ping' >/dev/null && curl -sf '$AI/proof/ping' >/dev/null"

section "Proof gate strict"
assert "strict blocks superlatives/%/x" \
"curl -s -X POST '$AI/one' -H 'x-proof-strict: 1' -H 'content-type: application/json' \
 --data '{\"prompt\":\"#1 with 200% growth and 10x ROI\",\"sessionId\":\"smk1\"}' | jq -er '.result.error==\"proof_gate_fail\"'"

section "Risk flag"
assert "/risk behaves" \
"curl -s '$AI/risk?prompt=%231+tool+with+200%25+growth+and+10x+impact' | jq -er '.risky==true'"

echo
echo "• Instant ship → spec id (preview optional)"
resp="$(curl -s -X POST "$AI/instant" \
  -H 'content-type: application/json' \
  -H 'x-ship-preview: 1' \
  --data '{"prompt":"sanity","sessionId":"pre"}')"

specId="$(jq -r '.spec.id' <<<"$resp")"
pageId="$(jq -r '.result.pageId' <<<"$resp")"

if [ -z "$specId" ] || [ "$specId" = "null" ]; then
  echo "  ❌ no specId from /instant"; exit 1
else
  echo "  ✅ spec id=$specId"
fi

echo
echo "• OG present"
if curl -s "$AI/previews/$specId" | grep -qi 'og:title'; then
  echo "  ✅ OG present (specId)"
elif [ -n "$pageId" ] && [ "$pageId" != "null" ] && curl -s "$AI/previews/$pageId" | grep -qi 'og:title'; then
  echo "  ✅ OG present (pageId)"
else
  echo "  ❌ OG meta not found"; exit 1
fi

section "Vectors / sections / evidence"
assert "vector search" "curl -s '$AI/vectors/search?q=saas&limit=2' | jq -er '.ok==true'"
assert "packs list" "curl -s '$AI/sections/packs?limit=2' | jq -er '.ok==true'"
assert "evidence add+search" \
"curl -s -X POST '$AI/evidence/add' -H 'content-type: application/json' \
 --data '{\"id\":\"t1\",\"url\":\"https://example.com\",\"title\":\"Example\",\"text\":\"Minimal landing pages are common.\"}' | jq -er '.ok==true' && \
 curl -s '$AI/evidence/search?q=minimal' | jq -er '.ok==true'"

# • Persona retrieve (audience header drives section mix)
section "Persona retrieve"

assert "developers → features present, pricing absent" \
"curl -s -X POST '$AI/act' -H 'content-type: application/json' -H 'x-audience: developers' \
 --data '{\"sessionId\":\"ps1\",\"spec\":{\"layout\":{\"sections\":[\"hero-basic\"]},\"brand\":{},\"intent\":{},\"audience\":\"\"},\"action\":{\"kind\":\"retrieve\",\"args\":{\"sections\":[\"hero-basic\"]}}}' \
 | jq -e '.result.sections | (index(\"features-3col\") != null) and (index(\"pricing-simple\") == null)' >/dev/null"

assert "founders → pricing present" \
"curl -s -X POST '$AI/act' -H 'content-type: application/json' -H 'x-audience: founders' \
 --data '{\"sessionId\":\"ps2\",\"spec\":{\"layout\":{\"sections\":[\"hero-basic\"]},\"brand\":{},\"intent\":{},\"audience\":\"\"},\"action\":{\"kind\":\"retrieve\",\"args\":{\"sections\":[\"hero-basic\"]}}}' \
 | jq -e '.result.sections | (index(\"pricing-simple\") != null)' >/dev/null"

section "Metrics surface"
assert "metrics present" "curl -s '$AI/metrics' | jq -er '.ok==true'"

echo; echo "=========================="
echo " SUP Algo smoke: PASSED"
echo "=========================="
