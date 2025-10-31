#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:3000}"
AI="$API/api/ai"

section(){ echo; echo "• $*"; }
ok(){ echo "  ✅ $*"; }
die(){ echo "  ❌ $*"; exit 1; }

# Run a command string inside bash -lc so pipes work with set -e -o pipefail
assert() {
  local msg="$1"; shift
  local cmd="$*"
  bash -lc "set -euo pipefail; $cmd" >/dev/null && ok "$msg" || die "$msg"
}

section "Risk & strict proof"
RISK="$(curl -s "$AI/risk?prompt=%231+tool+with+200%25+growth+and+10x+impact")"
assert "risk flag true" \
  "printf %s \"$RISK\" | jq -er '.risky == true'"

BLOCK="$(curl -s -X POST "$AI/one" \
  -H 'x-proof-strict: 1' -H 'content-type: application/json' \
  --data '{"prompt":"we are #1 with 200% gains and 10x ROI","sessionId":"deep1"}')"
assert "strict blocks risky prompt" \
  "printf %s \"$BLOCK\" | jq -er '.result.error==\"proof_gate_fail\"'"

section "Instant path (determinism + OG + no-JS)"
ONE="$(curl -s -X POST "$AI/instant?__test=1" -H 'x-test: 1' -H 'content-type: application/json' \
  --data '{"prompt":"dark saas waitlist for founders","sessionId":"deep2"}')"
URL="$(printf %s "$ONE" | jq -er '.url // .result.path')"
PID="$(printf %s "$ONE" | jq -er '.result.pageId')"
[ -n "$URL" ] || die "missing preview url"
HTML="$(curl -s "$API$URL")"
assert "OG present" \
  "printf %s \"$HTML\" | grep -q 'og:title'"
assert "no <script> tags" \
  "printf %s \"$HTML\" | grep -qi '<script' && exit 1 || exit 0"

section "Proof card"
PROOF="$(curl -s "$AI/proof/$PID")"
assert "proof json ok" \
  "printf %s \"$PROOF\" | jq -er '.ok==true and .proof.pageId!=\"\"'"

section "KPI hooks + shadow reward"
assert "convert ok" \
  "curl -s -X POST \"$AI/kpi/convert\" -H 'content-type: application/json' --data '{\"pageId\":\"$PID\"}' | jq -er '.ok==true'"
assert "kpi summary ok" \
  "curl -s \"$AI/kpi\" | jq -er '.ok==true'"

section "Metrics & flywheel"
MET="$(curl -s "$AI/metrics")"
assert "metrics ok" \
  "printf %s \"$MET\" | jq -er '.ok==true'"
assert "time_to_url present" \
  "printf %s \"$MET\" | jq -er '.time_to_url_ms_est != null'"
assert "url costs tracked" \
  "printf %s \"$MET\" | jq -er '.url_costs.pages >= 1'"

section "Vector search + seed"
assert "vector items" \
  "curl -s \"$AI/vectors/search?q=saas&limit=5\" | jq -er '.ok==true and (.items|length)>=1'"
assert "vector seed ok" \
  "curl -s -X POST \"$AI/vectors/seed\" -H 'content-type: application/json' --data '{\"count\":8,\"tags\":[\"saas\",\"ecommerce\"]}' | jq -er '.ok==true and .seeded==true'"

section "Section packs marketplace"
assert "packs list" \
  "curl -s \"$AI/sections/packs?limit=3\" | jq -er '.ok==true'"
assert "packs ingest" \
  "curl -s -X POST \"$AI/sections/packs/ingest\" -H 'content-type: application/json' --data '{\"packs\":[{\"sections\":[\"hero-basic\",\"cta-simple\"],\"tags\":[\"lab\"]}]}' | jq -er '.ok==true'"

section "Evidence index (CiteLock-Pro plumbing)"
assert "evidence add" \
  "curl -s -X POST \"$AI/evidence/add\" -H 'content-type: application/json' --data '{\"id\":\"t1\",\"url\":\"https://example.com\",\"title\":\"Example\",\"text\":\"Many teams prefer minimal landing pages.\"}' | jq -er '.ok==true'"
assert "evidence reindex" \
  "curl -s -X POST \"$AI/evidence/reindex\" | jq -er '.ok==true'"
assert "evidence search hit" \
  "curl -s \"$AI/evidence/search?q=minimal\" | jq -er '.hits|length>=1'"

section "Persona-aware retrieval"
READYSPEC='{"brand":{"dark":true},"layout":{"sections":["hero-basic","cta-simple"]},"copy":{"HEADLINE":"Hi"}}'
assert "retrieve ok" \
  "curl -s -X POST \"$AI/act\" -H 'x-audience: founders' -H 'content-type: application/json' --data '{\"sessionId\":\"deep3\",\"spec\":'$READYSPEC',\"action\":{\"kind\":\"retrieve\"}}' | jq -er '.result.kind==\"retrieve\"'"
assert "pricing added for founders" \
  "curl -s -X POST \"$AI/act\" -H 'x-audience: founders' -H 'content-type: application/json' --data '{\"sessionId\":\"deep3\",\"spec\":'$READYSPEC',\"action\":{\"kind\":\"retrieve\"}}' | jq -er '.result.sections | tostring | test(\"pricing-simple\")'"

section "Device gate (best-effort)"
DG="$(curl -s -X POST "$AI/one" -H 'x-device-gate: strict' -H 'content-type: application/json' --data '{"prompt":"light portfolio for designers","sessionId":"deep4"}')"
assert "device gate strict path exercised" \
  "printf %s \"$DG\" | jq -e '(.result.url != null) or (.result.error==\"device_gate_fail\")'"

section "Taste retrain (admin)"
assert "taste retrain" \
  "curl -s -X POST \"$AI/taste/retrain\" | jq -er '.ok==true'"

echo
echo "=============================="
echo " Deep verification: PASSED"
echo "=============================="
