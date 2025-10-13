# Supply Chain Security & Verification Guide

## Overview
This document describes YBUILT's supply chain security measures and provides verification procedures for SBOM, signatures, and provenance attestations.

## Supply Chain Artifacts

Every release produces the following artifacts:

1. **SBOM (Software Bill of Materials)** - `artifacts/sbom.json`
2. **GPG Signature** - `artifacts/dist.tar.gz.sig`
3. **Provenance Attestation** - `artifacts/provenance.json`
4. **Container Image** - `ghcr.io/OWNER/ybuilt:TAG`

## Artifact Generation

### Local Development

```bash
# Generate SBOM
npm run sbom

# Build and sign artifacts
npm run build
tar -czf artifacts/dist.tar.gz dist/
npm run sign

# Generate provenance
npm run provenance
```

### CI/CD Pipeline

Artifacts are automatically generated via GitHub Actions:

- **SBOM Generation:** `.github/workflows/supplychain.yml` (sbom-generation job)
- **Artifact Signing:** `.github/workflows/supplychain.yml` (sign-artifacts job)
- **Provenance:** `.github/workflows/supplychain.yml` (provenance job)

## Verification Procedures

### 1. Verify SBOM Integrity

**Download artifacts:**
```bash
gh release download v1.0.0 \
  -p "sbom.json" \
  -p "sbom.sha256"
```

**Verify SHA256 hash:**
```bash
# Calculate hash
sha256sum sbom.json | awk '{print $1}'

# Compare with stored hash
cat sbom.sha256
```

**Inspect SBOM contents:**
```bash
# View component summary
cat sbom.json | jq '.components | length'

# List all components
cat sbom.json | jq '.components[] | {name: .name, version: .version}'

# Check for vulnerabilities (using CycloneDX CLI)
cyclonedx-cli analyze sbom.json
```

### 2. Verify GPG Signature

**Prerequisites:**
- GPG installed
- YBUILT public key imported

**Import public key:**
```bash
# Download public key from repository
curl -O https://raw.githubusercontent.com/OWNER/ybuilt/main/public.key

# Import key
gpg --import public.key

# Trust key (optional, for verification)
gpg --edit-key YBUILT
# Type: trust → 5 (ultimate) → quit
```

**Download signed artifacts:**
```bash
gh release download v1.0.0 \
  -p "dist.tar.gz" \
  -p "dist.tar.gz.sig"
```

**Verify signature:**
```bash
gpg --verify dist.tar.gz.sig dist.tar.gz
```

**Expected output:**
```
gpg: Signature made <timestamp>
gpg:                using RSA key <KEY_ID>
gpg: Good signature from "YBUILT CI <ci@ybuilt.dev>"
```

⚠️ **Warning:** If you see "BAD signature", do NOT use the artifact!

### 3. Verify Provenance Attestation

**Download provenance:**
```bash
gh release download v1.0.0 -p "provenance.json"
```

**Verify structure (SLSA format):**
```bash
# Check provenance type
cat provenance.json | jq '._type'
# Should output: "https://in-toto.io/Statement/v0.1"

# Check predicate type
cat provenance.json | jq '.predicateType'
# Should output: "https://slsa.dev/provenance/v0.2"
```

**Verify build metadata:**
```bash
# Check Git commit
cat provenance.json | jq '.ybuilt.git.sha'

# Verify against GitHub
git rev-parse HEAD  # Should match

# Check build timestamp
cat provenance.json | jq '.ybuilt.build.timestamp'

# Check SBOM hash
cat provenance.json | jq '.ybuilt.sbom.digest.sha256'
```

**Verify artifact hash:**
```bash
# Extract artifact hash from provenance
PROVENANCE_HASH=$(cat provenance.json | jq -r '.subject[0].digest.sha256')

# Calculate actual artifact hash
ACTUAL_HASH=$(sha256sum dist.tar.gz | awk '{print $1}')

# Compare
if [ "$PROVENANCE_HASH" = "$ACTUAL_HASH" ]; then
  echo "✅ Artifact hash matches provenance"
else
  echo "❌ Hash mismatch! Artifact may be tampered"
fi
```

**Verify provenance signature (if signed):**
```bash
gh release download v1.0.0 -p "provenance.json.sig"
gpg --verify provenance.json.sig provenance.json
```

### 4. Verify Container Image

**Pull image:**
```bash
docker pull ghcr.io/OWNER/ybuilt:v1.0.0
```

**Inspect image layers:**
```bash
docker history ghcr.io/OWNER/ybuilt:v1.0.0
```

**Check image labels:**
```bash
docker inspect ghcr.io/OWNER/ybuilt:v1.0.0 | jq '.[0].Config.Labels'
```

**Scan for vulnerabilities:**
```bash
# Using Trivy
trivy image ghcr.io/OWNER/ybuilt:v1.0.0

# Using Grype
grype ghcr.io/OWNER/ybuilt:v1.0.0

# Using Snyk (if authenticated)
snyk container test ghcr.io/OWNER/ybuilt:v1.0.0
```

**Verify image attestation (future):**
```bash
# Using cosign (when implemented)
cosign verify ghcr.io/OWNER/ybuilt:v1.0.0
```

## Dependency Verification

### NPM Package Verification

**Audit dependencies:**
```bash
npm audit --json > audit-report.json
cat audit-report.json | jq '.vulnerabilities'
```

**Check for known malicious packages:**
```bash
# Using Socket.dev (if available)
socket security check package.json

# Using Snyk
snyk test --json > snyk-report.json
```

**Verify package-lock.json integrity:**
```bash
# Re-generate lock file
rm package-lock.json
npm install

# Compare with committed version
git diff package-lock.json
```

### License Compliance

**Extract licenses from SBOM:**
```bash
cat sbom.json | jq '.components[] | {name: .name, license: .licenses}'
```

**Check for incompatible licenses:**
```bash
# Using license-checker
npx license-checker --summary
```

## Security Scanning

### Static Analysis

```bash
# CodeQL (in CI)
# See .github/workflows/security.yml

# ESLint security rules
npm run lint

# Semgrep (if configured)
semgrep --config=auto
```

### Dynamic Analysis

```bash
# OWASP ZAP (baseline scan)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:5000

# Nuclei (if configured)
nuclei -u http://localhost:5000
```

## Incident Response

If you discover a compromised artifact:

### 1. Immediate Actions

- [ ] **Stop using the artifact immediately**
- [ ] **Notify security team:** security@ybuilt.dev
- [ ] **Document findings:** timestamps, hashes, comparison results
- [ ] **Isolate affected systems**

### 2. Investigation

- [ ] **Determine scope:** Which artifacts/versions affected?
- [ ] **Identify attack vector:** How was it compromised?
- [ ] **Check build logs:** Review CI/CD pipeline logs
- [ ] **Audit access:** Review who had access to signing keys

### 3. Remediation

- [ ] **Revoke compromised keys** (if applicable)
- [ ] **Delete malicious releases**
- [ ] **Publish security advisory**
- [ ] **Rotate secrets and credentials**
- [ ] **Rebuild and re-release from clean source**

### 4. Post-Incident

- [ ] **Update security procedures**
- [ ] **Enhance monitoring**
- [ ] **Conduct post-mortem**
- [ ] **Update this documentation**

## Best Practices

### For Developers

1. **Always verify artifacts** before deploying to production
2. **Use lock files** (package-lock.json) and commit them
3. **Pin dependencies** to specific versions in production
4. **Review dependency updates** before merging
5. **Run local SBOM generation** to understand dependencies

### For CI/CD

1. **Use minimal, pinned base images** in Dockerfiles
2. **Scan images before pushing** to registry
3. **Sign all release artifacts** with GPG
4. **Store signing keys securely** (GitHub Secrets, Vault)
5. **Enable audit logging** for all CI/CD activities

### For Operations

1. **Verify signatures** before deploying new versions
2. **Monitor for supply chain attacks** (Dependabot, Snyk)
3. **Maintain SBOM repository** for all deployed versions
4. **Regularly rotate signing keys** (quarterly)
5. **Conduct supply chain audits** (annually)

## Compliance & Attestation

YBUILT follows:

- **SLSA Level 2** (in progress to Level 3)
- **NIST SSDF** (Secure Software Development Framework)
- **CycloneDX SBOM** standard
- **SPDX** (future)

## Tools & Resources

### Required Tools

- **GPG:** Signature verification
- **jq:** JSON parsing
- **Trivy/Grype:** Vulnerability scanning
- **GitHub CLI:** Artifact download
- **Docker:** Container inspection

### Recommended Tools

- **Cosign:** Container signing (future)
- **SLSA Verifier:** Provenance verification
- **Socket.dev:** Dependency risk analysis
- **Syft:** Advanced SBOM generation

### References

- [SLSA Framework](https://slsa.dev)
- [CycloneDX Specification](https://cyclonedx.org)
- [NIST SSDF](https://csrc.nist.gov/Projects/ssdf)
- [GPG Documentation](https://gnupg.org/documentation/)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides)

## Contact

- **Security Team:** security@ybuilt.dev
- **Supply Chain Issues:** #ybuilt-security Slack channel
- **Vulnerability Reports:** [Security Policy](../SECURITY.md)

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-13 | 1.0 | Initial supply chain guide | Platform Team |
