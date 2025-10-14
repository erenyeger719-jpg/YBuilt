#!/bin/bash
set -euo pipefail

# Cosign Signing Script
# OIDC keyless signing OR key-based fallback with DRY_RUN mode

DRY_RUN=${DRY_RUN:-false}
ARTIFACT=${1:-artifacts/dist.tar.gz}
SBOM=${2:-artifacts/sbom.json}
PROVENANCE=${3:-artifacts/provenance.json}

if [ "$1" == "--dry-run" ]; then
    DRY_RUN=true
    ARTIFACT=${2:-artifacts/dist.tar.gz}
    SBOM=${3:-artifacts/sbom.json}
    PROVENANCE=${4:-artifacts/provenance.json}
fi

echo "🔐 Cosign Signing Script"
echo "   DRY_RUN: $DRY_RUN"
echo "   Artifact: $ARTIFACT"
echo "   SBOM: $SBOM"
echo "   Provenance: $PROVENANCE"
echo ""

# Check if cosign is installed
if ! command -v cosign &> /dev/null; then
    echo "⚠️  WARNING: cosign not installed"
    echo ""
    echo "📝 Installation instructions:"
    echo "   # macOS"
    echo "   brew install cosign"
    echo ""
    echo "   # Linux (binary)"
    echo "   curl -sLO https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64"
    echo "   sudo mv cosign-linux-amd64 /usr/local/bin/cosign"
    echo "   sudo chmod +x /usr/local/bin/cosign"
    echo ""
    echo "   # Verify installation"
    echo "   cosign version"
    
    if [ "$DRY_RUN" == "false" ]; then
        exit 1
    fi
    echo ""
    echo "✅ DRY_RUN mode: Continuing without cosign..."
    exit 0
fi

# Check if artifact exists
if [ ! -f "$ARTIFACT" ]; then
    echo "❌ ERROR: Artifact not found: $ARTIFACT"
    echo "📝 Run: npm run build && tar -czf $ARTIFACT dist/"
    exit 1
fi

# Attempt OIDC keyless signing first
echo "🔍 Attempting OIDC keyless signing..."

if [ "$DRY_RUN" == "true" ]; then
    echo "✅ DRY_RUN: Would sign with OIDC if ACTIONS_ID_TOKEN_REQUEST_TOKEN is set"
    echo "   cosign sign-blob --bundle cosign.bundle $ARTIFACT"
    
    if [ -f "$SBOM" ]; then
        echo "   cosign attest --predicate $SBOM --type cyclonedx $ARTIFACT"
    fi
    
    if [ -f "$PROVENANCE" ]; then
        echo "   cosign attest --predicate $PROVENANCE --type slsaprovenance $ARTIFACT"
    fi
    
    echo ""
    echo "📝 To enable OIDC keyless signing in GitHub Actions:"
    echo "   permissions:"
    echo "     id-token: write"
    echo "     packages: write"
    echo ""
    echo "   Then cosign will automatically use OIDC token from GitHub"
    exit 0
fi

# Check for OIDC token (GitHub Actions)
if [ -n "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ] && [ -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ]; then
    echo "✅ OIDC token available (GitHub Actions environment)"
    
    # Sign artifact
    cosign sign-blob \
        --bundle artifacts/cosign.bundle \
        "$ARTIFACT"
    
    # Attest SBOM
    if [ -f "$SBOM" ]; then
        cosign attest \
            --predicate "$SBOM" \
            --type cyclonedx \
            "$ARTIFACT"
    fi
    
    # Attest provenance
    if [ -f "$PROVENANCE" ]; then
        cosign attest \
            --predicate "$PROVENANCE" \
            --type slsaprovenance \
            "$ARTIFACT"
    fi
    
    echo "✅ OIDC keyless signing completed"
    exit 0
fi

# Fallback to key-based signing
echo "⚠️  OIDC not available, attempting key-based signing..."

if [ -n "${COSIGN_KEY:-}" ] || [ -f "cosign.key" ]; then
    KEY_FILE=${COSIGN_KEY:-cosign.key}
    
    # Sign artifact
    cosign sign-blob \
        --key "$KEY_FILE" \
        --bundle artifacts/cosign.bundle \
        "$ARTIFACT"
    
    # Attest SBOM
    if [ -f "$SBOM" ]; then
        cosign attest \
            --key "$KEY_FILE" \
            --predicate "$SBOM" \
            --type cyclonedx \
            "$ARTIFACT"
    fi
    
    # Attest provenance
    if [ -f "$PROVENANCE" ]; then
        cosign attest \
            --key "$KEY_FILE" \
            --predicate "$PROVENANCE" \
            --type slsaprovenance \
            "$ARTIFACT"
    fi
    
    echo "✅ Key-based signing completed"
    exit 0
fi

# No signing method available
echo "❌ ERROR: No signing method available"
echo ""
echo "📝 Options:"
echo "   1. Run in GitHub Actions with id-token: write permission (OIDC)"
echo "   2. Generate cosign key pair:"
echo "      cosign generate-key-pair"
echo "      export COSIGN_KEY=cosign.key"
echo "   3. Run with --dry-run to see what would happen"
exit 1
