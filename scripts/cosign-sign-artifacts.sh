#!/usr/bin/env bash
# cosign-sign-artifacts.sh - Sign build artifacts (not container images)
set -euo pipefail

TARBALL="${1:-artifacts/dist.tar.gz}"
SBOM="${2:-artifacts/sbom.json}"
PROVENANCE="${3:-artifacts/provenance.json}"
DRY_RUN="${DRY_RUN:-false}"

echo "🔐 Signing Build Artifacts with Cosign"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Tarball: ${TARBALL}"
echo "SBOM: ${SBOM}"
echo "Provenance: ${PROVENANCE}"
echo "Dry Run: ${DRY_RUN}"

# Check cosign availability
if ! command -v cosign &> /dev/null; then
  echo "⚠️  WARNING: cosign not installed"
  echo ""
  echo "📝 Installation instructions:"
  echo "  # macOS"
  echo "  brew install cosign"
  echo ""
  echo "  # Linux (binary)"
  echo "  curl -sLO https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64"
  echo "  sudo mv cosign-linux-amd64 /usr/local/bin/cosign"
  echo "  sudo chmod +x /usr/local/bin/cosign"
  echo ""
  echo "  # GitHub Actions"
  echo "  - uses: sigstore/cosign-installer@v3"
  
  if [ "${DRY_RUN}" = "true" ]; then
    echo "✅ DRY_RUN mode: Continuing without cosign..."
    exit 0
  else
    echo "❌ cosign required for signing. Exiting."
    exit 1
  fi
fi

# Skip signing in dry-run mode
if [ "${DRY_RUN}" = "true" ]; then
  echo "⏭️  DRY_RUN mode: Skipping actual signing"
  exit 0
fi

# Determine signing method
SIGN_CMD="cosign sign-blob --yes"
if [ -n "${COSIGN_KEY:-}" ]; then
  echo "🔑 Using key-based signing"
  SIGN_CMD="cosign sign-blob --yes --key env://COSIGN_KEY"
else
  echo "🔓 Using keyless (OIDC) signing"
fi

# Sign tarball
if [ -f "${TARBALL}" ]; then
  echo "📦 Signing tarball..."
  ${SIGN_CMD} \
    --bundle="${TARBALL}.cosign.bundle" \
    "${TARBALL}"
  echo "✅ Tarball signed: ${TARBALL}.cosign.bundle"
else
  echo "⚠️  Tarball not found: ${TARBALL}"
fi

# Sign SBOM
if [ -f "${SBOM}" ]; then
  echo "📋 Signing SBOM..."
  ${SIGN_CMD} \
    --bundle="${SBOM}.cosign.bundle" \
    "${SBOM}"
  echo "✅ SBOM signed: ${SBOM}.cosign.bundle"
else
  echo "⚠️  SBOM not found: ${SBOM}"
fi

# Sign provenance
if [ -f "${PROVENANCE}" ]; then
  echo "📜 Signing provenance..."
  ${SIGN_CMD} \
    --bundle="${PROVENANCE}.cosign.bundle" \
    "${PROVENANCE}"
  echo "✅ Provenance signed: ${PROVENANCE}.cosign.bundle"
else
  echo "⚠️  Provenance not found: ${PROVENANCE}"
fi

# Create combined bundle for workflow upload
echo "📦 Creating combined bundle..."
mkdir -p artifacts

# Verify all bundles exist
MISSING_BUNDLES=()
[ ! -f "${TARBALL}.cosign.bundle" ] && MISSING_BUNDLES+=("${TARBALL}.cosign.bundle")
[ ! -f "${SBOM}.cosign.bundle" ] && MISSING_BUNDLES+=("${SBOM}.cosign.bundle")
[ ! -f "${PROVENANCE}.cosign.bundle" ] && MISSING_BUNDLES+=("${PROVENANCE}.cosign.bundle")

if [ ${#MISSING_BUNDLES[@]} -gt 0 ]; then
  echo "❌ ERROR: Missing signature bundles:"
  printf '  - %s\n' "${MISSING_BUNDLES[@]}"
  echo ""
  echo "Signing must complete for all artifacts before release."
  exit 1
fi

# All bundles present, create combined bundle
cat "${TARBALL}.cosign.bundle" "${SBOM}.cosign.bundle" "${PROVENANCE}.cosign.bundle" > artifacts/cosign.bundle
echo "✅ Combined bundle created: artifacts/cosign.bundle"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Artifact signing complete!"
echo ""
echo "Verification commands:"
echo "  cosign verify-blob --bundle ${TARBALL}.cosign.bundle ${TARBALL}"
echo "  cosign verify-blob --bundle ${SBOM}.cosign.bundle ${SBOM}"
echo "  cosign verify-blob --bundle ${PROVENANCE}.cosign.bundle ${PROVENANCE}"
