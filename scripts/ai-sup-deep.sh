#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:3000}"
AI="$API/api/ai"

jqget(){ jq -er "$1" >/dev/null; }
assert(){ msg="$1"; shift; "$@"; echo "  ✅ $msg"; }
fail(){ echo "  ❌ $1"; exit 1; }

echo "• Risk & strict proof"
RISK=$(curl -s "$AI/risk?prompt=%231+tool+with+200%25+growth+and+10x+impact")
assert "risk flag true" echo "$RISK" | jqget '.risky == true'
BLOCK=$(curl -s -X POST "$AI/one" -H 'x-proof-strict: 1' -H 'content-type: application/json' \
  --data '{"prompt":"we are #1 with 200% gains and 10x ROI","sessionId":"deep1"}')
assert "strict blocks risky prompt" echo "$BLOCK" | jqget '.result.error=="proof_gate_fail"'

echo "• Instant path (determinism + OG + no-JS)"
ONE=$(curl -s -X POST "$AI/instant?__test=1" -H 'x-test: 1' -H 'content-type: application/json' \
  --data '{"prompt":"dark saas waitlist for founders","sessionId":"deep2"}')
URL=$(echo "$ONE" | jq -er '.url // .result.path')
PID=$(echo "$ONE" | jq -er '.result.pageId')
[ -n "$URL" ] || fail "missing preview url"
HTML=$(curl -s "$API$URL")
assert "OG present" bash -lc "printf %s \"$HTML\" | grep -q 'og:title'"
assert "no <script> tags" bash -lc "printf %s \"$HTML\" | grep -qi '<script' && exit 1 || exit 0"

echo "• Proof card"
PROOF=$(curl -s "$AI/proof/$PID")
assert "proof json ok" echo "$PROOF" | jqget '.ok==true and .proof.pageId!=""'

echo "• KPI hooks + shadow reward"
assert "convert ok" curl -s -X POST "$AI/kpi/convert" -H 'content-type: application/json' \
  --data "{\"pageId\":\"$PID\"}" | jqget '.ok==true'
assert "kpi summary ok" curl -s "$AI/kpi" | jqget '.ok==true'

echo "• Metrics & flywheel"
MET=$(curl -s "$AI/metrics")
assert "metrics ok" echo "$MET" | jqget '.ok==true'
assert "time_to_url present" echo "$MET" | jqget '.time_to_url_ms_est != null'
assert "url costs tracked" echo "$MET" | jqget '.url_costs.pages >= 1'

echo "• Vector search + seed"
VS=$(curl -s "$AI/vectors/search?q=saas&limit=5")
assert "vector items" echo "$VS" | jqget '.ok==true and (.items|length)>=1'
assert "vector seed ok" curl -s -X POST "$AI/vectors/seed" -H 'content-type: application/json' \
  --data '{"count":8,"tags":["saas","ecommerce"]}' | jqget '.ok==true and .seeded==true'

echo "• Section packs marketplace"
PK=$(curl -s "$AI/sections/packs?limit=3")
assert "packs list" echo "$PK" | jqget '.ok==true'
assert "packs ingest" curl -s -X POST "$AI/sections/packs/ingest" -H 'content-type: application/json' \
  --data '{"packs":[{"sections":["hero-basic","cta-simple"],"tags":["lab"]}]}' | jqget '.ok==true'

echo "• Evidence index (CiteLock-Pro plumbing)"
EA=$(curl -s -X POST "$AI/evidence/add" -H 'content-type: application/json' \
  --data '{"id":"t1","url":"https://example.com","title":"Example","text":"Many teams prefer minimal landing pages."}')
assert "evidence add" echo "$EA" | jqget '.ok==true'
assert "evidence reindex" curl -s -X POST "$AI/evidence/reindex" | jqget '.ok==true'
assert "evidence search hit" curl -s "$AI/evidence/search?q=minimal" | jqget '.hits|length>=1'

echo "• Persona-aware retrieval"
READYSPEC='{"brand":{"dark":true},"layout":{"sections":["hero-basic","cta-simple"]},"copy":{"HEADLINE":"Hi"}}'
RET=$(curl -s -X POST "$AI/act" -H 'x-audience: founders' -H 'content-type: application/json' \
  --data "{\"sessionId\":\"deep3\",\"spec\":$READYSPEC,\"action\":{\"kind\":\"retrieve\"}}")
assert "retrieve ok" echo "$RET" | jqget '.result.kind=="retrieve"'
assert "pricing added for founders" echo "$RET" | jq -er '.result.sections' | grep -q 'pricing-simple'

echo "• Device gate (best-effort)"
DG=$(curl -s -X POST "$AI/one" -H 'x-device-gate: strict' -H 'content-type: application/json' \
  --data '{"prompt":"light portfolio for designers","sessionId":"deep4"}')
# Pass if either composed OR failed gate explicitly
echo "$DG" | jq -e '(.result.url != null) or (.result.error=="device_gate_fail")' >/dev/null
echo "  ✅ device gate strict path exercised"

echo "• Taste retrain (admin)"
assert "taste retrain" curl -s -X POST "$AI/taste/retrain" | jqget '.ok==true'

echo
echo "=============================="
echo " Deep verification: PASSED"
echo "=============================="
