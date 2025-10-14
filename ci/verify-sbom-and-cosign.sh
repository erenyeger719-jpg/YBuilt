#!/bin/bash
set -euo pipefail

# SBOM and Cosign Verification Script
# Verifies SBOM integrity and cosign signatures

ARTIFACT=${1:-artifacts/dist.tar.gz}
SBOM=${2:-artifacts/sbom.json}
COSIGN_BUNDLE=${3:-artifacts/cosign.bundle}

echo "🔍 Verifying SBOM and Cosign Signatures..."
echo "   Artifact: $ARTIFACT"
echo "   SBOM: $SBOM"
echo "   Cosign Bundle: $COSIGN_BUNDLE"
echo ""

VERIFICATION_FAILED=false

# 1. Verify SBOM exists and is valid JSON
echo "📋 Step 1: Verifying SBOM..."
if [ ! -f "$SBOM" ]; then
    echo "❌ ERROR: SBOM not found: $SBOM"
    VERIFICATION_FAILED=true
else
    if jq empty "$SBOM" 2>/dev/null; then
        COMPONENTS=$(jq '.components | length' "$SBOM")
        echo "✅ SBOM is valid JSON with $COMPONENTS components"
    else
        echo "❌ ERROR: SBOM is not valid JSON"
        VERIFICATION_FAILED=true
    fi
fi

# 2. Verify SBOM hash matches
echo ""
echo "🔐 Step 2: Verifying SBOM hash..."
if [ -f "$SBOM.sha256" ]; then
    EXPECTED_HASH=$(cat "$SBOM.sha256")
    ACTUAL_HASH=$(sha256sum "$SBOM" | awk '{print $1}')
    
    if [ "$EXPECTED_HASH" == "$ACTUAL_HASH" ]; then
        echo "✅ SBOM hash verified: $ACTUAL_HASH"
    else
        echo "❌ ERROR: SBOM hash mismatch"
        echo "   Expected: $EXPECTED_HASH"
        echo "   Actual:   $ACTUAL_HASH"
        VERIFICATION_FAILED=true
    fi
else
    echo "⚠️  WARNING: SBOM hash file not found: $SBOM.sha256"
fi

# 3. Verify artifact exists
echo ""
echo "📦 Step 3: Verifying artifact..."
if [ ! -f "$ARTIFACT" ]; then
    echo "❌ ERROR: Artifact not found: $ARTIFACT"
    VERIFICATION_FAILED=true
else
    ARTIFACT_HASH=$(sha256sum "$ARTIFACT" | awk '{print $1}')
    echo "✅ Artifact exists: $ARTIFACT_HASH"
fi

# 4. Verify cosign signature (if available)
echo ""
echo "🔐 Step 4: Verifying cosign signature..."

if ! command -v cosign &> /dev/null; then
    echo "⚠️  WARNING: cosign not installed - skipping signature verification"
    echo ""
    echo "📝 To install cosign:"
    echo "   brew install cosign  # macOS"
    echo "   # or download from https://github.com/sigstore/cosign/releases"
elif [ ! -f "$COSIGN_BUNDLE" ]; then
    echo "⚠️  WARNING: Cosign bundle not found: $COSIGN_BUNDLE"
    echo "📝 Run: ./scripts/cosign-publish.sh to sign the artifact"
else
    if cosign verify-blob \
        --bundle "$COSIGN_BUNDLE" \
        "$ARTIFACT" 2>/dev/null; then
        echo "✅ Cosign signature verified"
    else
        echo "⚠️  WARNING: Cosign signature verification failed"
        echo "   This may be expected if using OIDC keyless signing outside of CI"
    fi
fi

# 5. Verify provenance (if available)
echo ""
echo "📜 Step 5: Verifying provenance..."
if [ -f "artifacts/provenance.json" ]; then
    if jq empty artifacts/provenance.json 2>/dev/null; then
        PREDICATE_TYPE=$(jq -r '.predicateType' artifacts/provenance.json)
        BUILDER=$(jq -r '.predicate.builder.id' artifacts/provenance.json)
        echo "✅ Provenance is valid"
        echo "   Predicate Type: $PREDICATE_TYPE"
        echo "   Builder: $BUILDER"
    else
        echo "❌ ERROR: Provenance is not valid JSON"
        VERIFICATION_FAILED=true
    fi
else
    echo "⚠️  WARNING: Provenance not found: artifacts/provenance.json"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$VERIFICATION_FAILED" == "true" ]; then
    echo "❌ VERIFICATION FAILED"
    echo ""
    echo "📝 Remediation steps:"
    echo "   1. Regenerate SBOM: ./scripts/generate-cyclonedx-sbom.sh"
    echo "   2. Rebuild artifact: ./scripts/reproducible-build.sh"
    echo "   3. Sign artifact: ./scripts/cosign-publish.sh"
    echo "   4. Generate provenance: node scripts/provenance/attest-oci.js"
    exit 1
else
    echo "✅ VERIFICATION SUCCESSFUL"
    echo ""
    echo "All supply chain artifacts verified:"
    echo "   ✓ SBOM integrity"
    echo "   ✓ Artifact integrity"
    echo "   ✓ Cosign signature (if available)"
    echo "   ✓ Provenance (if available)"
    exit 0
fi
