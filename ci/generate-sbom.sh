#!/bin/bash
set -euo pipefail

# SBOM Generation Script
# Generates CycloneDX SBOM for YBUILT application

echo "📦 Generating SBOM (Software Bill of Materials)..."

# Create artifacts directory
mkdir -p artifacts

# Check for SBOM tools (prefer CycloneDX, fallback to syft)
if command -v cyclonedx-node &> /dev/null; then
    echo "✅ Using CycloneDX for SBOM generation"
    cyclonedx-node -o artifacts/sbom.json
elif command -v syft &> /dev/null; then
    echo "✅ Using Syft for SBOM generation"
    syft dir:. -o cyclonedx-json=artifacts/sbom.json
elif npx --yes @cyclonedx/cyclonedx-npm --help &> /dev/null; then
    echo "✅ Using npx @cyclonedx/cyclonedx-npm for SBOM generation"
    npx --yes @cyclonedx/cyclonedx-npm --output-file artifacts/sbom.json
else
    echo "❌ ERROR: No SBOM tool found!"
    echo "📝 Install one of:"
    echo "   npm install -g @cyclonedx/cyclonedx-npm"
    echo "   brew install syft (macOS) or snap install syft (Linux)"
    exit 1
fi

# Validate SBOM was created
if [ ! -f "artifacts/sbom.json" ]; then
    echo "❌ ERROR: SBOM generation failed - artifacts/sbom.json not found"
    exit 1
fi

# Calculate and display SBOM hash
SBOM_HASH=$(sha256sum artifacts/sbom.json | awk '{print $1}')
echo "✅ SBOM generated successfully"
echo "📊 SBOM size: $(wc -c < artifacts/sbom.json) bytes"
echo "🔐 SBOM SHA256: $SBOM_HASH"
echo ""
echo "📁 Output: artifacts/sbom.json"

# Store hash for provenance
echo "$SBOM_HASH" > artifacts/sbom.sha256
