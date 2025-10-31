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

section "Instant ship → spec id (preview optional)"
RESP=$(curl -s -X POST "$AI/instant?__test=1" -H 'x-test: 1' -H 'content-type: application/json' \
 --data '{"prompt":"dark saas waitlist for founders","sessionId":"smk2"}')
SPEC_ID=$(printf %s "$RESP" | jq -r '.spec.id // empty')
[ -n "$SPEC_ID" ] && ok "spec id=$SPEC_ID" || die "no spec id"

URL=$(printf %s "$RESP" | jq -r '.url // .result.path // empty')
if [ -n "$URL" ]; then
  HTML="$(curl -s "$API$URL")"
  assert "OG present" "printf %s \"$HTML\" | grep -q 'og:title'"
  assert "no <script> tags" "printf %s \"$HTML\" | grep -qi '<script' && exit 1 || exit 0"
else
  echo "  ℹ️ preview not persisted (ok in instant-only mode)"
fi

section "Vectors / sections / evidence"
assert "vector search" "curl -s '$AI/vectors/search?q=saas&limit=2' | jq -er '.ok==true'"
assert "packs list" "curl -s '$AI/sections/packs?limit=2' | jq -er '.ok==true'"
assert "evidence add+search" \
"curl -s -X POST '$AI/evidence/add' -H 'content-type: application/json' \
 --data '{\"id\":\"t1\",\"url\":\"https://example.com\",\"title\":\"Example\",\"text\":\"Minimal landing pages are common.\"}' | jq -er '.ok==true' && \
 curl -s '$AI/evidence/search?q=minimal' | jq -er '.ok==true'"

# • Persona retrieve (seed first so retrieval isn't empty)
section "Persona retrieve"
assert "seed retrieval examples" \
"curl -s -X POST '$AI/seed' -H 'content-type: application/json' >/dev/null"

assert "add persona example" \
"curl -s -X POST '$AI/persona/add' -H 'content-type: application/json' \
 --data '{\"text\":\"founder who likes dark saas minimal\",\"label\":\"founder\"}' >/dev/null"

assert "retrieve ok" \
"curl -s '$AI/persona/retrieve?q=founder&k=5' | jq -e '.items | length > 0' >/dev/null"

section "Metrics surface"
assert "metrics present" "curl -s '$AI/metrics' | jq -er '.ok==true'"

echo; echo "=========================="
echo " SUP Algo smoke: PASSED"
echo "=========================="
