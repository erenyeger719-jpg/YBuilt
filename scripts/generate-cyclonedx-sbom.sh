#!/bin/bash
set -euo pipefail

# CycloneDX SBOM Generation Script
# Generates Software Bill of Materials in CycloneDX format

echo "📦 Generating CycloneDX SBOM..."

# Create artifacts directory
mkdir -p artifacts/sbom

# Check for SBOM tools (prefer @cyclonedx/cyclonedx-npm)
if command -v cyclonedx-npm &> /dev/null; then
    echo "✅ Using cyclonedx-npm CLI"
    cyclonedx-npm --output-file artifacts/sbom.json
elif npx --yes @cyclonedx/cyclonedx-npm --help &> /dev/null; then
    echo "✅ Using npx @cyclonedx/cyclonedx-npm"
    npx --yes @cyclonedx/cyclonedx-npm --output-file artifacts/sbom.json
else
    echo "❌ ERROR: @cyclonedx/cyclonedx-npm not found"
    echo "📝 Install: npm install -g @cyclonedx/cyclonedx-npm"
    exit 1
fi

# Validate SBOM was created
if [ ! -f "artifacts/sbom.json" ]; then
    echo "❌ ERROR: SBOM generation failed"
    exit 1
fi

# Calculate SBOM hash
SBOM_HASH=$(sha256sum artifacts/sbom.json | awk '{print $1}')
echo "$SBOM_HASH" > artifacts/sbom.json.sha256

# Extract components count
COMPONENTS_COUNT=$(jq '.components | length' artifacts/sbom.json 2>/dev/null || echo "N/A")

# Display results
echo ""
echo "✅ SBOM generated successfully"
echo "📁 Output: artifacts/sbom.json"
echo "🔐 SHA256: $SBOM_HASH"
echo "📊 Size: $(wc -c < artifacts/sbom.json) bytes"
echo "📦 Components: $COMPONENTS_COUNT"
echo ""
echo "🔍 View SBOM:"
echo "   jq . artifacts/sbom.json | less"
echo "   jq '.components[] | {name: .name, version: .version}' artifacts/sbom.json"
