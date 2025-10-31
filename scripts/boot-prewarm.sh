#!/usr/bin/env bash
set -euo pipefail

API="${1:-http://localhost:5050}"
TOKEN="${PREWARM_TOKEN:-changeme}"

# Persist .cache to a mounted volume if present (Render/Docker: mount /data)
if [ -d /data ]; then
  mkdir -p /data/cache
  if [ ! -L ".cache" ]; then
    rm -rf .cache 2>/dev/null || true
    ln -s /data/cache .cache
  fi
fi

hdr=(-H "x-prewarm-token: $TOKEN")

echo "Prewarm → $API"
# try up to 30s for server to come up
for i in {1..30}; do
  if curl -fsS "${API}/api/ai/instant?goal=ping" "${hdr[@]}" >/dev/null; then break; fi
  sleep 1
done

curl -fsS "${API}/api/ai/og?url=https://example.com" "${hdr[@]}" >/dev/null
curl -fsS -X POST "${API}/api/ai/one" -H "content-type: application/json" "${hdr[@]}" \
  --data '{"prompt":"prewarm hello","sessionId":"warm1"}' >/dev/null

# mark service ready
curl -fsS -X POST "${API}/api/ai/__ready" "${hdr[@]}" >/dev/null
echo "READY"
