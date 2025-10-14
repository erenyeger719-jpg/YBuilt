# Fix for cosign-publish.sh Workflow Integration

## Issue
The `.github/workflows/publish.yml` calls `cosign-publish.sh` with **file paths** but the script expects **image name and tag**:

**Current (BROKEN):**
```yaml
./scripts/cosign-publish.sh \
  artifacts/dist.tar.gz \
  artifacts/sbom.json \
  artifacts/provenance.json
```

**Script expects:**
```bash
IMAGE_NAME="${1:-ghcr.io/OWNER/ybuilt}"
IMAGE_TAG="${2:-latest}"
```

## Remediation

### Option 1: Fix Workflow to Pass Correct Arguments

Update `.github/workflows/publish.yml`:

```yaml
      - name: Build and push container image
        run: |
          docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.ref_name }} .
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.ref_name }}
      
      - name: Sign with cosign (OIDC)
        if: steps.oidc-check.outputs.oidc_available == 'true'
        run: |
          chmod +x scripts/cosign-publish.sh
          ./scripts/cosign-publish.sh \
            "${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}" \
            "${{ github.ref_name }}"
        env:
          SBOM_PATH: artifacts/sbom.json
          PROVENANCE_PATH: artifacts/provenance.json
```

### Option 2: Create Separate Script for Artifact Signing

Create `scripts/cosign-sign-artifacts.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

TARBALL="${1:-artifacts/dist.tar.gz}"
SBOM="${2:-artifacts/sbom.json}"
PROVENANCE="${3:-artifacts/provenance.json}"

echo "🔐 Signing build artifacts with cosign..."

# Sign tarball
cosign sign-blob --yes \
  --bundle="$TARBALL.cosign.bundle" \
  "$TARBALL"

# Sign SBOM
cosign sign-blob --yes \
  --bundle="$SBOM.cosign.bundle" \
  "$SBOM"

# Sign provenance
cosign sign-blob --yes \
  --bundle="$PROVENANCE.cosign.bundle" \
  "$PROVENANCE"

echo "✅ All artifacts signed successfully"
```

Then update workflow:
```yaml
      - name: Sign artifacts with cosign
        run: |
          chmod +x scripts/cosign-sign-artifacts.sh
          ./scripts/cosign-sign-artifacts.sh \
            artifacts/dist.tar.gz \
            artifacts/sbom.json \
            artifacts/provenance.json
```

### Option 3: Unified Approach (Recommended)

Keep `cosign-publish.sh` for container images, create dedicated artifact signing:

**For Container Images:**
```bash
./scripts/cosign-publish.sh ghcr.io/OWNER/ybuilt v1.2.3
```

**For Build Artifacts:**
```bash
./scripts/cosign-sign-artifacts.sh artifacts/dist.tar.gz artifacts/sbom.json artifacts/provenance.json
```

## Implementation

1. Choose Option 3 (cleanest separation)
2. Create `scripts/cosign-sign-artifacts.sh` (see Option 2)
3. Update `.github/workflows/publish.yml` to:
   - Build/push Docker image
   - Call `cosign-publish.sh` with image name/tag
   - Call `cosign-sign-artifacts.sh` with artifact paths

## Verification

```bash
# Test container image signing
./scripts/cosign-publish.sh --dry-run ghcr.io/test/ybuilt v1.0.0

# Test artifact signing
./scripts/cosign-sign-artifacts.sh artifacts/dist.tar.gz artifacts/sbom.json artifacts/provenance.json

# Verify signatures
cosign verify ghcr.io/test/ybuilt:v1.0.0
cosign verify-blob --bundle artifacts/dist.tar.gz.cosign.bundle artifacts/dist.tar.gz
```

## Current Status
⚠️ **BROKEN**: Workflow will fail when calling cosign-publish.sh  
✅ **FIX READY**: Use Option 3 above to separate concerns properly
