#!/bin/bash
set -euo pipefail

# Artifact Signing Script
# Signs build artifacts using GPG

ARTIFACT_PATH="${1:-artifacts/dist.tar.gz}"
SIGNATURE_PATH="${2:-artifacts/dist.tar.gz.sig}"

echo "🔐 Signing artifact: $ARTIFACT_PATH"

# Check if GPG is available
if ! command -v gpg &> /dev/null; then
    echo "❌ ERROR: GPG not found"
    echo "📝 Install GPG:"
    echo "   macOS: brew install gnupg"
    echo "   Ubuntu: apt-get install gnupg"
    echo "   Alpine: apk add gnupg"
    exit 1
fi

# Check if artifact exists
if [ ! -f "$ARTIFACT_PATH" ]; then
    echo "❌ ERROR: Artifact not found: $ARTIFACT_PATH"
    echo "📝 Run 'npm run build && tar -czf $ARTIFACT_PATH dist/' first"
    exit 1
fi

# Check for GPG private key
if [ -z "${GPG_PRIVATE_KEY:-}" ] && [ -z "${GPG_KEY_ID:-}" ]; then
    echo "⚠️  WARNING: No GPG_PRIVATE_KEY or GPG_KEY_ID environment variable set"
    echo "📝 For CI/CD, set GPG_PRIVATE_KEY secret with your private key"
    echo "📝 For local signing, ensure GPG key is in keyring"
    
    # Check if there's a default key in the keyring
    if ! gpg --list-secret-keys &> /dev/null; then
        echo "❌ ERROR: No GPG keys found in keyring"
        echo "📝 Generate a key: gpg --full-generate-key"
        exit 1
    fi
fi

# Import GPG key if provided via environment
if [ -n "${GPG_PRIVATE_KEY:-}" ]; then
    echo "📥 Importing GPG key from environment..."
    echo "$GPG_PRIVATE_KEY" | gpg --batch --import 2>/dev/null || {
        echo "❌ ERROR: Failed to import GPG key"
        exit 1
    }
fi

# Sign the artifact
echo "✍️  Signing with GPG..."
gpg --armor --output "$SIGNATURE_PATH" --detach-sign "$ARTIFACT_PATH" || {
    echo "❌ ERROR: GPG signing failed"
    exit 1
}

# Verify signature
echo "✅ Verifying signature..."
gpg --verify "$SIGNATURE_PATH" "$ARTIFACT_PATH" || {
    echo "❌ ERROR: Signature verification failed"
    exit 1
}

# Display fingerprint
FINGERPRINT=$(gpg --verify "$SIGNATURE_PATH" "$ARTIFACT_PATH" 2>&1 | grep "using" | head -1)
echo "✅ Artifact signed successfully"
echo "🔑 $FINGERPRINT"
echo "📁 Signature: $SIGNATURE_PATH"

# Calculate hashes
ARTIFACT_HASH=$(sha256sum "$ARTIFACT_PATH" | awk '{print $1}')
SIG_HASH=$(sha256sum "$SIGNATURE_PATH" | awk '{print $1}')

echo ""
echo "🔐 Artifact SHA256: $ARTIFACT_HASH"
echo "🔐 Signature SHA256: $SIG_HASH"

# Store metadata
cat > "${SIGNATURE_PATH}.meta" <<EOF
{
  "artifact": "$ARTIFACT_PATH",
  "signature": "$SIGNATURE_PATH",
  "artifact_sha256": "$ARTIFACT_HASH",
  "signature_sha256": "$SIG_HASH",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "📊 Metadata saved: ${SIGNATURE_PATH}.meta"
