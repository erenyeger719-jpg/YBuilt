#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://localhost:5050}"
AI="$API/api/ai"

resp=$(curl -s -X POST "$AI/instant" -H 'content-type: application/json' -H 'x-ship-preview: 1' \
  --data '{"prompt":"sanity","sessionId":"pre"}')

specId=$(jq -r '.spec.id' <<<"$resp")
pageId=$(jq -r '.result.pageId' <<<"$resp")

[ -n "$specId" ] || { echo "❌ no specId from /instant"; exit 1; }

if curl -s "$AI/previews/$specId" | grep -qi 'og:title' || \
   curl -s "$AI/previews/$pageId" | grep -qi 'og:title'; then
  echo "OG present ✅  (specId=$specId pageId=$pageId)"
else
  echo "❌ OG meta not found"; exit 1
fi
