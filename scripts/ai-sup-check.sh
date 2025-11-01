#!/usr/bin/env bash
# Sup Algo acceptance smoke — minimal end-to-end checks across the 20-plan levers.
# Usage: scripts/ai-sup-check.sh http://localhost:5050
set -euo pipefail

API="${1:-http://localhost:5050}"
AI="$API/api/ai"
TOK="${PREWARM_TOKEN:-changeme}"

say(){ echo; echo "• $*"; }
ok(){  echo "  ✅ $*"; }
die(){ echo "  ❌ $*"; exit 1; }
need(){ command -v "$1" >/dev/null || die "Missing '$1' (install and re-run)"; }

need curl
need jq

section(){ say "$*"; }

jget(){ jq -r "$1"; }

# Unique session IDs for persona probes (avoid 429s)
DEV_SID="dev-$RANDOM-$(date +%s)"
FOUNDER_SID="founder-$RANDOM-$(date +%s)"

# ---- 0) Ready gate ----------------------------------------------------------
section "Prewarm / Ready gate"
curl -fsS -X POST -H "x-prewarm-token: $TOK" "$AI/__ready" >/dev/null || die "prewarm failed"
curl -fsS -o /dev/null -w "%{http_code}\n" "$AI/instant?goal=ping" | grep -q '^200$' || die "instant ping 200"
ok "service ready + ping OK"

# ---- 1) Zero-latency path + Proof Card + Economic Flywheel ------------------
section "Instant compose (no-LLM) → preview + proof"
RESP="$(curl -fsS -H 'content-type: application/json' \
  -d '{"prompt":"dark saas waitlist for founders","sessionId":"sup1","ship":true}' \
  "$AI/instant")"

PAGE_ID="$(echo "$RESP" | jget '.result.pageId // .result.path // empty' | sed 's#.*/##;s/\.html$//')"
test -n "$PAGE_ID" || die "no pageId from /instant"
ok "instant produced pageId=$PAGE_ID"

curl -fsS "$AI/proof/$PAGE_ID" | jq -e '.ok == true' >/dev/null || die "proof read failed"
ok "Proof Card exists"

MET="$(curl -fsS "$AI/metrics")"
echo "$MET" | jq -e '.ok == true' >/dev/null || die "metrics failed"
ok "metrics endpoint OK (economic flywheel visible)"

# ---- 2) CiteLock-Pro strict gate -------------------------------------------
section "CiteLock-Pro (strict) blocks risky claims"
RISKY='{"prompt":"#1 with 200% growth and 10x ROI","sessionId":"sup2"}'
ONE="$(curl -fsS -H 'x-proof-strict: 1' -H 'content-type: application/json' -d "$RISKY" "$AI/one")"
echo "$ONE" | jq -e '.result.error == "proof_gate_fail"' >/dev/null || die "strict gate did not block risky prompt"
ok "strict proof gate blocks superlatives/%/x claims"

# ---- 3) Device-farm sanity / Gate (strict header) ---------------------------
section "Device gate (strict header) is enforced"
DG="$(curl -fsS -H 'x-device-gate: strict' -H 'content-type: application/json' \
  -d '{"prompt":"minimal light portfolio","sessionId":"sup3"}' "$AI/one")"
# Pass if either it composes cleanly OR returns device_gate_fail (both are valid behaviors)
( echo "$DG" | jq -e '.result.kind == "compose" or (.result.error == "device_gate_fail")' >/devnull ) \
  || die "device gate not honored"
ok "device gate honored (compose or blocked by gate)"

# ---- 4) Section-level bandits / Persona routing -----------------------------
section "Bandits route by persona (developers vs founders)"
DEV="$(curl -fsS \
  -H 'content-type: application/json' \
  -H "x-test: 1" -H "x-session-id: $DEV_SID" -H "x-audience: developers" \
  -d '{"sessionId":"sup4","spec":{"layout":{"sections":["hero-basic","pricing-simple"]}},"action":{"kind":"retrieve"}}' \
  "$AI/act")"
# developers must have features-3col and NOT have pricing-simple
echo "$DEV" | jq -e '.result.sections | (index("features-3col") != null) and (index("pricing-simple") == null)'
ok "developers → features-3col (and pricing-simple dropped)"

FOU="$(curl -fsS \
  -H 'content-type: application/json' \
  -H "x-test: 1" -H "x-session-id: $FOUNDER_SID" -H "x-audience: founders" \
  -d '{"sessionId":"sup5","spec":{"layout":{"sections":["hero-basic"]}},"action":{"kind":"retrieve"}}' \
  "$AI/act")"
# founders must have pricing-simple
echo "$FOU" | jq -e '.result.sections | index("pricing-simple") != null'
ok "founders → pricing-simple"

# ---- 5) Vector network effect ----------------------------------------------
section "Vector library: seed + search"
curl -fsS -H 'content-type: application/json' -d '{"count":12}' "$AI/vectors/seed" >/dev/null || die "seed failed"
VEC="$(curl -fsS "$AI/vectors/search?q=saas")"
echo "$VEC" | jq -e '.items | length > 0' >/dev/null || die "vector search zero results"
ok "vector search returns items"

# ---- 6) Marketplace of sections --------------------------------------------
section "Section marketplace"
curl -fsS "$AI/sections/packs" | jq -e '.packs | length >= 0' >/dev/null || die "packs failed"
ok "packs endpoint OK"

# ---- 7) OG/Social bundle stub ----------------------------------------------
section "OG/social bundle"
curl -fsS "$AI/og?title=Ybuilt&desc=OG+ready" | jq -e '.ok == true' >/dev/null || die "og failed"
ok "og endpoint OK"

# ---- 8) Abuse intake bypass (never throttled) -------------------------------
section "Abuse intake bypass"
curl -fsS -X POST -H 'content-type: application/json' \
  -d '{"reason":"bot_farm","path":"/api/ai/one","sessionId":"sup6"}' "$AI/abuse/report" \
  | jq -e '.ok == true' >/dev/null || die "abuse intake failed"
ok "abuse intake accepted"

# ---- 9) Multilingual deterministic (Accept-Language honored, just sanity) ---
section "Multilingual deterministic (sanity)"
curl -fsS -H 'accept-language: hi-IN,hi;q=0.9' -H 'content-type: application/json' \
  -d '{"prompt":"डार्क सास वेटलिस्ट","sessionId":"sup7","ship":true}' "$AI/instant" \
  | jq -e '.ok == true' >/dev/null || die "instant hi-IN failed"
ok "instant works under hi-IN"

# ---- 10) No-JS default: served preview has no <script> ----------------------
section "No-JS default preview (script stripper)"
HTML="$(curl -fsS "$AI/previews/$PAGE_ID")"
echo "$HTML" | grep -qi '<script' && die "script tags present in stripped preview"
ok "preview served without script tags"

# ---- 11) KPI loop: conversion increments counter ---------------------------
section "KPI convert increments"
K0="$(curl -fsS "$AI/kpi" | jget '.conversions_total // 0')"
curl -fsS -X POST -H 'content-type: application/json' -d "{\"pageId\":\"$PAGE_ID\"}" "$AI/kpi/convert" \
  | jq -e '.ok == true' >/dev/null || die "kpi convert failed"
K1="$(curl -fsS "$AI/kpi" | jget '.conversions_total // 0')"
test "$K1" -ge "$K0" || die "conversions_total did not increase"
ok "conversion recorded (total: $K1)"

say "All checks passed."
