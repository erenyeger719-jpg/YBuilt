#!/usr/bin/env bash
# scripts/reproducible-build.sh
# Produces a deterministic tarball artifacts/dist.tar.gz and artifacts/dist.tar.gz.sha256
set -euo pipefail

# Where outputs land
ARTIFACT_DIR="${ARTIFACT_DIR:-artifacts}"
DIST_TGZ="${ARTIFACT_DIR}/dist.tar.gz"
DIST_SHA="${DIST_TGZ}.sha256"

mkdir -p "${ARTIFACT_DIR}"

# Determine SOURCE_DATE_EPOCH in a deterministic way (prefer git commit time)
if [ -n "${SOURCE_DATE_EPOCH:-}" ]; then
  : # use provided
else
  if git rev-parse --git-dir > /dev/null 2>&1; then
    SOURCE_DATE_EPOCH="$(git log -1 --format=%ct 2>/dev/null || date +%s)"
  else
    SOURCE_DATE_EPOCH="$(date +%s)"
  fi
fi

export SOURCE_DATE_EPOCH
export TZ=UTC

echo "SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}"
echo "Building reproducible artifact..."

# Install exact dependencies according to lockfile (CI-friendly)
if [ -f package-lock.json ]; then
  echo "Running npm ci --prefer-offline --no-audit"
  npm ci --prefer-offline --no-audit
else
  echo "No package-lock.json found — running npm install (not ideal for reproducibility)"
  npm install --no-audit --prefer-offline
fi

# Ensure build script exists
if npm run | grep -q "build"; then
  echo "Running npm run build with SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}"
  # Export SOURCE_DATE_EPOCH for tools that honor it
  env SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH}" TZ=UTC npm run build
else
  echo "No npm build script detected — packaging repo sources as-is"
fi

# Decide what to include in the tarball:
# Prefer dist/ then build/ then fallback to package files
TEMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT

if [ -d dist ]; then
  echo "Packaging dist/ directory"
  cp -a dist "$TEMP_DIR"/dist
elif [ -d build ]; then
  echo "Packaging build/ directory"
  cp -a build "$TEMP_DIR"/build
else
  echo "Packaging project files (src, package.json, package-lock.json)"
  mkdir -p "$TEMP_DIR"/src
  if [ -d src ]; then cp -a src "$TEMP_DIR"/src; fi
  cp -a package.json package-lock.json README.md 2>/dev/null || true
fi

# Create deterministic tarball:
# - --sort=name ensures deterministic ordering
# - --mtime set to SOURCE_DATE_EPOCH
# - --owner/--group to remove uid/gid differences
echo "Creating deterministic tarball ${DIST_TGZ}"
tar --sort=name \
    --owner=0 --group=0 --numeric-owner \
    --mtime="@${SOURCE_DATE_EPOCH}" \
    -C "$TEMP_DIR" -czf "${DIST_TGZ}" .

# Compute sha256
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${DIST_TGZ}" | awk '{print $1}' > "${DIST_SHA}"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${DIST_TGZ}" | awk '{print $1}' > "${DIST_SHA}"
else
  echo "No sha256 tool found; cannot create ${DIST_SHA}" >&2
  exit 2
fi

echo "Created artifacts:"
ls -lah "${DIST_TGZ}" "${DIST_SHA}"
echo "Done."
