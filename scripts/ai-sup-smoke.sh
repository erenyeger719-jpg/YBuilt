#!/usr/bin/env bash
# scripts/ai-sup-smoke.sh
set -euo pipefail

BASE="${BASE:-http://localhost:5050}"
JSON='content-type: application/json'

say() { printf "• %s\n" "$*"; }
ok()  { printf "  ✅ %s\n" "$*"; }
die() { printf "  ❌ %s\n" "$*"; exit 1; }

# 0) Pings — keep these boring
say "Pings"
curl -sf "$BASE/api/ai/instant?goal=ping" | jq -e '.ok==true' >/dev/null || die "instant ping"
curl -sf "$BASE/api/ai/proof/ping"       | jq -e '.ok==true' >/dev/null || die "proof ping"
ok "instant/proof up"

# 1) Proof strict gate (risky prompt → block)
say "Proof gate strict"
curl -sf -X POST "$BASE/api/ai/one" \
  -H "$JSON" -H 'x-proof-strict: 1' \
  -d '{"prompt":"We are #1 and 200% better than competitors","sessionId":"proof"}' \
| jq -e 'select(.result.error=="proof_gate_fail")' >/dev/null || die "strict gate"
ok "strict blocks superlatives/%/x"

# 2) Risk endpoint sanity
say "Risk flag"
curl -sf "$BASE/api/ai/risk?prompt=We%20are%20%231%20and%20200%25%20better" \
| jq -e '.risky==true' >/dev/null || die "/risk true"
curl -sf "$BASE/api/ai/risk?prompt=Calm%20minimal%20waitlist" \
| jq -e '.risky==false' >/dev/null || die "/risk false"
ok "/risk behaves"

# 3) Instant ship (no-LLM path), capture pageId
say "Instant ship → pageId"
PAGE=$(curl -sf -X POST "$BASE/api/ai/instant" -H "$JSON" \
  -d '{"prompt":"dark saas waitlist for founders","sessionId":"smoke"}' | jq -r '.result.pageId')
test "$PAGE" != "null" && test -n "$PAGE" || die "no pageId"
ok "pageId=$PAGE"

# 4) Preview HTML has OG; ships no-JS by default
say "Preview OG + no-JS"
HTML="$(curl -sf "$BASE/api/ai/previews/$PAGE")"
grep -q 'og:title' <<<"$HTML"   || die "missing og:title"
grep -qi '<script' <<<"$HTML" && die "unexpected <script> shipped" || true
ok "OG present, no <script>"

# 5) Proof Card exists and structured
say "Proof card"
curl -sf "$BASE/api/ai/proof/$PAGE" \
| jq -e '
  .ok==true and
  (.proof|type=="object") and
  (.proof|has("fact_counts")) and
  (.proof|has("a11y"))
' >/dev/null || die "proof card"
ok "Proof card emitted"


# 6) KPI endpoints (convert + summary)
say "KPI hooks"
curl -sf -X POST "$BASE/api/ai/kpi/convert" -H "$JSON" -d "{\"pageId\":\"$PAGE\"}" \
| jq -e '.ok==true' >/dev/null || die "convert"
curl -sf "$BASE/api/ai/kpi" | jq -e '.ok==true' >/dev/null || die "kpi summary"
ok "KPI convert/summary OK"

# 7) Retrieval hit-rate & TTU exposed (Sup Algo metrics)
say "Metrics surface"
curl -sf "$BASE/api/ai/metrics" \
| jq -e 'has("retrieval_hit_rate_pct") and has("time_to_url_ms_est") and has("url_costs")' >/dev/null \
|| die "metrics shape"
ok "metrics present"

# 8) Vector search (network effect path)
say "Vector search"
curl -sf "$BASE/api/ai/vectors/search?q=saas&limit=4" \
| jq -e '.ok==true and (.items|length)>=1' >/dev/null || die "vectors/search"
ok "vector search returns"

# 9) Seed more vectors then re-search
say "Vector seed"
curl -sf -X POST "$BASE/api/ai/vectors/seed" -H "$JSON" \
  -d '{"count": 8, "tags":["saas","ecommerce"]}' \
| jq -e '.ok==true' >/dev/null || die "vectors/seed"
curl -sf "$BASE/api/ai/vectors/search?q=ecommerce&limit=4" \
| jq -e '.ok==true and (.items|length)>=1' >/dev/null || die "vectors/search ecommerce"
ok "vector seed/search OK"

# 10) Packs marketplace (list + ingest)
say "Section packs"
curl -sf "$BASE/api/ai/sections/packs?limit=5" | jq -e '.ok==true' >/dev/null || die "packs list"
curl -sf -X POST "$BASE/api/ai/sections/packs/ingest" -H "$JSON" \
  -d '{"packs":[{"sections":["hero-basic","faq-accordion","cta-simple"],"tags":["qa","docs"]}]}' \
| jq -e '.ok==true and .added==1' >/dev/null || die "packs ingest"
ok "packs list/ingest OK"

# 11) Evidence index (CiteLock-Pro admin)
say "Evidence add/search"
curl -sf -X POST "$BASE/api/ai/evidence/add" -H "$JSON" \
  -d '{"id":"ex1","url":"https://example.com","title":"Example","text":"Calm landing pages improve conversions."}' \
| jq -e '.ok==true' >/dev/null || die "evidence add"
curl -sf -X POST "$BASE/api/ai/evidence/reindex" | jq -e '.ok==true' >/dev/null || die "evidence reindex"
curl -sf "$BASE/api/ai/evidence/search?q=conversions" \
| jq -e '.ok==true and (.hits|length)>=1' >/dev/null || die "evidence search"
ok "evidence index OK"

# 12) TasteNet-lite retrain (best-effort)
say "Taste retrain"
curl -sf -X POST "$BASE/api/ai/taste/retrain" | jq -e '.ok==true' >/dev/null || die "taste retrain"
ok "taste retrain OK"

# 13) Audience-aware retrieve (low-creep personalization)
say "Retrieve → persona adds sections"
curl -sf -X POST "$BASE/api/ai/act" -H "$JSON" -H 'x-audience: developers' \
  -d '{"sessionId":"t","spec":{"layout":{"sections":["hero-basic"]}}, "action":{"kind":"retrieve"}}' \
| jq -e '.result.sections | index("features-3col") >= 0' >/dev/null || die "dev persona swap"
ok "persona swap adds features-3col"

# 14) Ask/patch actions
say "Ask/patch"
curl -sf -X POST "$BASE/api/ai/act" -H "$JSON" \
  -d '{"sessionId":"t","spec":{},"action":{"kind":"ask"}}' \
| jq -e '.result.chips|type=="array"' >/dev/null || die "ask chips"
curl -sf -X POST "$BASE/api/ai/act" -H "$JSON" \
  -d '{"sessionId":"t","spec":{},"action":{"kind":"patch","args":{"theme":"dark"}}}' \
| jq -e '.result.spec.brand.dark==true' >/dev/null || die "patch dark"
ok "ask chips + patch OK"

# 15) Media generator (vector-first)
say "Media synth"
curl -sf -X POST "$BASE/api/ai/media" -H "$JSON" \
  -d '{"kind":"illustration","prompt":"minimal hero shape","prefer":"vector"}' \
| jq -e '.ok==true and .asset' >/dev/null || die "media"
ok "media OK"

# 16) Clarify → compose round-trip (zero-LLM)
say "Clarify-compose"
curl -sf -X POST "$BASE/api/ai/clarify/compose" -H "$JSON" \
  -d '{"prompt":"light portfolio for designer","sessionId":"clar"}' \
| jq -e '.ok==true and (.result.pageId != null)' >/dev/null || die "clarify compose"
ok "clarify-compose OK"

# 17) Chips apply increments edits then ship records it
say "Edit metrics"
curl -sf -X POST "$BASE/api/ai/chips/apply" -H "$JSON" \
  -d '{"sessionId":"ed","spec":{},"chip":"Use dark mode"}' \
| jq -e '.ok==true' >/dev/null || die "chip apply"
curl -sf -X POST "$BASE/api/ai/one" -H "$JSON" \
  -d '{"prompt":"minimal waitlist","sessionId":"ed"}' >/dev/null || die "ship after edit"
curl -sf "$BASE/api/ai/metrics" \
| jq -e 'has("edits_to_ship_est")' >/dev/null || die "edits metric"
ok "edits_to_ship recorded"

# 18) Device sanity / perf matrix signals (best-effort; non-strict)
say "Device/perf signaling (best-effort)"
curl -sf -X POST "$BASE/api/ai/one" -H "$JSON" \
  -H 'x-device-gate: on' \
  -d '{"prompt":"dark saas waitlist","sessionId":"gate"}' >/dev/null || die "compose with gate on"
ok "device gate path exercised"

# 19) Vectors search cold-start path (limit=1)
say "Vectors cold-start fallback check"
curl -sf "$BASE/api/ai/vectors/search?limit=1" \
| jq -e '.ok==true and ((.items|length)>=1)' >/dev/null || die "vectors cold-start"
ok "vectors fallback OK"

# 20) Economic flywheel counters exist
say "Economic flywheel"
curl -sf "$BASE/api/ai/metrics" \
| jq -e '.url_costs|has("pages") and has("cents_total") and has("tokens_total")' >/dev/null \
|| die "url costs summary"
ok "url costs summary present"

echo
echo "=============================="
echo " Sup Algo / 20-lever smoke: OK"
echo "=============================="
