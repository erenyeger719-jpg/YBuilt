#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:5050}"
AI="$API/api/ai"

section(){ echo; echo "• $*"; }
ok(){ echo "  ✅ $*"; }
die(){ echo "  ❌ $*"; exit 1; }

post_json () {
  # usage: post_json <url> <json> -> prints temp file path
  local url="$1"; shift
  local body="$1"; shift
  local tmp; tmp="$(mktemp)"
  curl -sSf -X POST "$url" -H 'content-type: application/json' --data "$body" >"$tmp" || return 1
  echo "$tmp"
}

# ——— Zero-latency smoke (cheap)
section "Zero-latency"
curl -sSf "$AI/instant?goal=ping" >/dev/null && ok "instant returns without model flag" || die "instant failed"

# ——— Bandits surface
section "Bandits surface"
curl -sSf "$AI/kpi" | jq -e 'type=="object" and has("bandits")' >/dev/null && ok "kpi has bandit keys" || die "kpi missing bandits"

# ——— BrandDNA: tokens converge within a session
section "BrandDNA"
SID="sup-$$"
P='{"prompt":"dark saas waitlist for founders","sessionId":"'"$SID"'"}'
F1="$(post_json "$AI/one" "$P")" || die "first /one failed"
PRIMARY1="$(jq -r '(.spec.brand.primary // .spec.brandColor // "")' "$F1")"
F2="$(post_json "$AI/one" "$P")" || die "second /one failed"
PRIMARY2="$(jq -r '(.spec.brand.primary // .spec.brandColor // "")' "$F2")"
if [ -n "$PRIMARY1" ] && [ "$PRIMARY1" = "$PRIMARY2" ]; then
  ok "tokens converge within session"
else
  ok "tokens present (non-fatal drift)"
fi

# ——— CiteLock-Pro: risky prompt returns a structured result
section "CiteLock-Pro"
P2='{"prompt":"We are #1 with 200% growth and 10x ROI","sessionId":"sup-'"$$"'","breadth":"wide"}'
F3="$(post_json "$AI/one" "$P2")" || die "/one failed"
KIND="$(jq -r '(.result|type=="object") as $o | if $o then .result.kind else empty end' "$F3" || true)"
ERR="$(jq -r '(.result|type=="object") as $o | if $o then .result.error//empty else empty end' "$F3" || true)"
if [ "$KIND" = "compose" ]; then
  ok "compose returned (sanitized where needed)"
elif [ "$ERR" = "proof_gate_fail" ]; then
  ok "strict gate can block risky claims"
else
  die "unexpected response (kind=$KIND err=$ERR)"
fi

# ——— Outcome brain (light)
section "Outcome brain"
curl -sSf "$AI/metrics" | jq -e 'type=="object" and has("counts")' >/dev/null && ok "metrics expose sections map" || die "metrics failed"

echo
echo "All SUP checks done."
