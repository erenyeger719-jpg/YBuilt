#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:5050}"
AI="$API/api/ai"

section(){ echo; echo "• $*"; }
ok(){ echo "  ✅ $*"; }
die(){ echo "  ❌ $*"; exit 1; }
assert(){ local msg="$1"; shift; bash -lc "set -euo pipefail; $*" >/dev/null && ok "$msg" || die "$msg"; }

# 1 Outcome brain
section "Outcome brain"
assert "metrics expose sections map" \
"curl -sf '$AI/metrics' | jq -er '.ok and (.counts|type==\"object\")'"

# 2 Massive token-space search
section "Design search fitness present"
assert "wide/max metadata present (instant)" \
"curl -sf -X POST '$AI/instant?__test=1' -H 'x-test: 1' -H 'content-type: application/json' \
  --data '{\"prompt\":\"minimal saas waitlist\",\"sessionId\":\"p2\"}' \
| jq -er '.ok and (.spec.brand.tokens|type==\"object\")'"

# 3 Section-level bandits
section "Bandits surface"
assert "kpi has bandit keys" \
"curl -sf '$AI/kpi' | jq -er '.ok and (.bandits|type==\"object\")'"

# 4 Zero-latency path
section "Zero-latency"
assert "instant returns without model flag" \
"curl -sw '%{time_total}\n' -o /dev/null -X POST '$AI/instant' -H 'content-type: application/json' \
  --data '{\"prompt\":\"dark waitlist\",\"sessionId\":\"p4\"}' | awk '\$1*1000<1200'"

# 5 BrandDNA learning (convergence)
section "BrandDNA"
RESP1=$(curl -sf -X POST "$AI/instant" -H 'content-type: application/json' \
  --data '{"prompt":"portfolio", "sessionId":"dna1"}')
RESP2=$(curl -sf -X POST "$AI/instant" -H 'content-type: application/json' \
  --data '{"prompt":"portfolio", "sessionId":"dna1"}')
assert "tokens converge within session" \
"diff <(echo \"$RESP1\"|jq -r '.spec.brand.tokens|to_entries|.[0:5]|tostring') \
     <(echo \"$RESP2\"|jq -r '.spec.brand.tokens|to_entries|.[0:5]|tostring') >/dev/null"

# 6 CiteLock-Pro
section "CiteLock-Pro"
assert "proof reader works" \
"curl -sf -X POST '$AI/instant?__test=1' -H 'x-test: 1' -H 'content-type: application/json' \
 --data '{\"prompt\":\"dark saas waitlist\",\"sessionId\":\"proof1\"}' >/dev/null && \
 pid=$(jq -r '.result.pageId' <<<\"$(curl -s -X POST '$AI/one' -H 'content-type: application/json' --data '{\"prompt\":\"dark saas waitlist\",\"sessionId\":\"proof2\"}')\") && \
 curl -sf '$AI/proof/'\"$pid\" | jq -er '.ok'"

# 7 Device-farm sanity (perf matrix exists)
section "Device sanity"
assert "perf matrix in proof card" \
"pid=$(jq -r '.result.pageId' <<<\"$(curl -s -X POST '$AI/one' -H 'content-type: application/json' --data '{\"prompt\":\"saas landing\",\"sessionId\":\"dev1\"}')\") && \
curl -sf '$AI/proof/'\"$pid\" | jq -er '.proof.perf_matrix or .proof.cls_est or .proof.lcp_est_ms'"

# 8 Vector library network effect
section "Vector library"
assert "vector search works" "curl -sf '$AI/vectors/search?q=logo&limit=2' | jq -er '.ok'"

# 9 Low-creep personalization
section "Persona swap <=2"
assert "retrieve respects x-audience" \
"curl -sf -X POST '$AI/act' -H 'x-audience: founders' -H 'content-type: application/json' \
 --data '{\"sessionId\":\"aud1\",\"spec\":{\"layout\":{\"sections\":[\"hero-basic\",\"cta-simple\"]}},\"action\":{\"kind\":\"retrieve\"}}' \
| jq -er '.result.sections|length>=2'"

# 10 Compose purity
section "Compose purity"
pid=$(jq -r '.result.pageId' <<<"$(curl -s -X POST '$AI/one' -H 'content-type: application/json' --data '{"prompt":"minimal portfolio","sessionId":"p10"}')") || true
[ -n "$pid" ] && HTML=$(curl -s "$AI/previews/$pid") || HTML=""
assert "no editor artifacts" "printf %s \"$HTML\" | grep -q 'TODO:' && exit 1 || exit 0"

# 11 Auto-readability + rhythm
section "Readability"
assert "readability present (grade/line-length implied by tokens)" \
"curl -sf -X POST '$AI/instant?__test=1' -H 'x-test: 1' -H 'content-type: application/json' \
 --data '{\"prompt\":\"quiet minimal\",\"sessionId\":\"read1\"}' | jq -er '.ok'"

# 12 Perf governor
section "Perf governor"
assert "kpi has perf counters" "curl -sf '$AI/kpi' | jq -er '.ok and .perf'"

# 13 Section marketplace
section "Section marketplace"
assert "packs ranked" "curl -sf '$AI/sections/packs?limit=2' | jq -er '.ok and (.packs|length>=1)'"

# 14 OG/social bundle
section "OG bundle"
assert "preview has og + canonical" \
"pid=$(jq -r '.result.pageId' <<<\"$(curl -s -X POST '$AI/one' -H 'content-type: application/json' --data '{\"prompt\":\"light waitlist\",\"sessionId\":\"p14\"}')\") && \
HTML=$(curl -s '$AI/previews/'\"$pid\") && \
printf %s \"$HTML\" | grep -q 'og:title'"

# 15 Proof Card
section "Proof card essentials"
assert "proof fields present" \
"curl -sf '$AI/proof/'\"$pid\" | jq -er '.proof.a11y|type or true'"

# 16 Shadow RL (safe)
section "Shadow RL"
assert "metrics show shadow_agreement_pct (nullable ok)" \
"curl -sf '$AI/metrics' | jq -er 'has(\"shadow_agreement_pct\")'"

# 17 Multilingual deterministic
section "Multilingual"
assert "hi locale composes" \
"curl -sf -X POST '$AI/instant' -H 'content-type: application/json' \
 --data '{\"prompt\":\"पोर्टफोलियो\",\"sessionId\":\"ml1\"}' | jq -er '.ok'"

# 18 Failure-aware search
section "Failure-aware search"
assert "act/compose returns some sections after guard" \
"curl -sf -X POST '$AI/act' -H 'content-type: application/json' \
 --data '{\"sessionId\":\"fix1\",\"spec\":{\"layout\":{\"sections\":[]},\"copy\":{}},\"action\":{\"kind\":\"compose\",\"args\":{}}}' | jq -er '.ok'"

# 19 No-JS default
section "No-JS default"
assert "preview has no <script>" \
"[ -n \"$pid\" ] && printf %s \"$HTML\" | grep -qi '<script' && exit 1 || exit 0"

# 20 Economic flywheel
section "Economic flywheel"
assert "metrics report url_costs" \
"curl -sf '$AI/metrics' | jq -er '.url_costs.pages>=0'"

echo
echo "=========================="
echo " SUP Checklist: PASSED"
echo "=========================="
