#!/usr/bin/env bash
set -euo pipefail

echo "🔥 YBUILT Smoke Test - Fast Local Self-Test"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create artifacts directory
mkdir -p artifacts

# Step 1: Install dependencies with lockfile verification
echo ""
echo "📦 Step 1/5: Verifying lockfile and installing dependencies..."
if ! node scripts/verify-lockfile.js; then
  echo -e "${RED}❌ Lockfile verification failed${NC}"
  echo "💡 Remediation: npm install && git add package-lock.json"
  exit 1
fi

npm ci --prefer-offline --no-audit
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 2: Reproducible build
echo ""
echo "🏗️  Step 2/5: Creating reproducible build..."
export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct 2>/dev/null || date +%s)
export TZ=UTC

if ! bash scripts/reproducible-build.sh; then
  echo -e "${RED}❌ Reproducible build failed${NC}"
  echo "💡 Remediation: Check build errors above, ensure vite is available: npx vite build"
  exit 1
fi

if [ ! -f artifacts/dist.tar.gz ]; then
  echo -e "${RED}❌ Build artifact not created${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Reproducible build complete${NC}"
ls -lh artifacts/dist.tar.gz artifacts/dist.tar.gz.sha256

# Step 3: Generate SBOM
echo ""
echo "📋 Step 3/5: Generating SBOM (CycloneDX)..."
if ! bash scripts/generate-cyclonedx-sbom.sh; then
  echo -e "${YELLOW}⚠️  SBOM generation failed (non-critical)${NC}"
  echo "💡 Remediation: npm install -g @cyclonedx/cyclonedx-npm"
else
  if [ -f artifacts/sbom.json ]; then
    echo -e "${GREEN}✅ SBOM generated${NC}"
    echo "   Size: $(du -h artifacts/sbom.json | cut -f1)"
  fi
fi

# Step 4: Generate provenance (dry-run)
echo ""
echo "🔐 Step 4/5: Generating SLSA provenance (dry-run)..."
if [ -f scripts/provenance/attest-oci.js ]; then
  if ! node scripts/provenance/attest-oci.js --out artifacts/provenance.json; then
    echo -e "${YELLOW}⚠️  Provenance generation failed (non-critical)${NC}"
  else
    echo -e "${GREEN}✅ Provenance generated${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Provenance script not found (skipping)${NC}"
fi

# Step 5: Cosign dry-run
echo ""
echo "✍️  Step 5/5: Running cosign signature dry-run..."
if command -v cosign >/dev/null 2>&1; then
  if ! bash scripts/cosign-sign-artifacts.sh --artifact artifacts/dist.tar.gz --dry-run; then
    echo -e "${YELLOW}⚠️  Cosign dry-run failed (non-critical)${NC}"
    echo "💡 Remediation: Install cosign: brew install cosign (or see cosign.dev)"
  else
    echo -e "${GREEN}✅ Cosign dry-run passed${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  cosign not found (skipping signature test)${NC}"
  echo "💡 Install: curl -sSfL https://github.com/sigstore/cosign/releases/latest/download/cosign-$(uname | tr '[:upper:]' '[:lower:]')-amd64 -o /usr/local/bin/cosign && chmod +x /usr/local/bin/cosign"
fi

# Summary
echo ""
echo "============================================"
echo -e "${GREEN}🎉 Smoke Test Complete!${NC}"
echo ""
echo "Artifacts created:"
ls -lh artifacts/ 2>/dev/null | tail -n +2 || echo "  (no artifacts)"
echo ""
echo "Next steps:"
echo "  - Review artifacts in ./artifacts/"
echo "  - Push to GitHub to trigger full CI/CD"
echo "  - Deploy with: kubectl apply -f k8s/"
