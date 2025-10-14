#!/bin/bash
set -euo pipefail

# Reproducible Build Script
# Ensures deterministic builds with stable SHA256 hashes across runs
# Uses SOURCE_DATE_EPOCH and TZ=UTC for timestamp normalization

echo "🔨 Starting reproducible build..."

# Set deterministic environment
export SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH:-$(git log -1 --pretty=%ct 2>/dev/null || date +%s)}
export TZ=UTC
export NODE_ENV=production

echo "📅 SOURCE_DATE_EPOCH: $SOURCE_DATE_EPOCH ($(date -u -d @$SOURCE_DATE_EPOCH 2>/dev/null || date -u -r $SOURCE_DATE_EPOCH))"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/ artifacts/dist.tar.gz artifacts/dist.tar.gz.sha256

# Install dependencies with lock file (deterministic)
echo "📦 Installing dependencies (locked versions)..."
npm ci --prefer-offline --no-audit --quiet

# Build with deterministic settings
echo "🏗️  Building application..."
npm run build

# Verify dist/ was created
if [ ! -d "dist" ]; then
    echo "❌ ERROR: dist/ directory not created"
    exit 1
fi

# Create artifacts directory
mkdir -p artifacts

# Create deterministic tarball (sorted, mtime normalized)
echo "📦 Creating deterministic tarball..."
tar --create \
    --gzip \
    --file artifacts/dist.tar.gz \
    --mtime="@${SOURCE_DATE_EPOCH}" \
    --sort=name \
    --owner=0 \
    --group=0 \
    --numeric-owner \
    dist/

# Calculate SHA256
DIST_HASH=$(sha256sum artifacts/dist.tar.gz | awk '{print $1}')
echo "$DIST_HASH" > artifacts/dist.tar.gz.sha256

# Display results
echo ""
echo "✅ Reproducible build completed"
echo "📁 Output: artifacts/dist.tar.gz"
echo "🔐 SHA256: $DIST_HASH"
echo "📊 Size: $(wc -c < artifacts/dist.tar.gz) bytes"
echo ""
echo "🔍 To verify reproducibility, run this script twice:"
echo "   First run SHA256:  $(cat artifacts/dist.tar.gz.sha256)"
echo "   Second run should produce the same hash"
echo ""
echo "📝 Reproducibility factors:"
echo "   - SOURCE_DATE_EPOCH: $SOURCE_DATE_EPOCH"
echo "   - TZ: $TZ"
echo "   - npm ci: locked dependencies"
echo "   - tar: sorted, normalized mtime/ownership"
