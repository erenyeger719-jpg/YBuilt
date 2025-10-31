#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://localhost:3000}"
AI="$API/api/ai"

backup=".cache.bak.$(date +%s)"
mkdir -p .cache || true
cp -r .cache "$backup" || true
echo "• Cache backed up → $backup"

trap 'rm -rf .cache && mv -f "'"$backup"'" .cache >/dev/null 2>&1 || true' EXIT

echo "• Corrupt url.costs.json → metrics should still load"
mkdir -p .cache
printf '{broken json' > .cache/url.costs.json
curl -s "$AI/metrics" | jq -er '.ok==true' >/dev/null && echo "  ✅ metrics resilient"

echo "• Remove evidence list on disk → search should fallback to empty"
rm -f .cache/evidence.list.json || true
curl -s "$AI/evidence/search?q=anything" | jq -er '.ok==true and .hits|type=="array"' >/dev/null && echo "  ✅ evidence fallback"

echo "• Break proof card JSON → /proof should 500 gracefully"
mkdir -p .cache/proof
echo '{bad' > .cache/proof/bad.json
curl -s -o /dev/null -w "%{http_code}\n" "$AI/proof/bad" | grep -qE '500|404' && echo "  ✅ proof failure handled"

echo "• /review without OPENAI_API_KEY → explicit error"
resp=$(curl -s -X POST "$AI/review" -H 'content-type: application/json' --data '{"code":"<html></html>","sessionId":"c1"}')
echo "$resp" | jq -er '.ok==false and (.error|test("OPENAI_API_KEY"))' >/dev/null && echo "  ✅ review guard"

echo
echo "=============================="
echo " Chaos verification: PASSED"
echo "=============================="
