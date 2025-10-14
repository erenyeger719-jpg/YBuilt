# Git Commands for Industrial Hardening (Manual Execution Required)

**Environment:**
- Node.js: v20.19.3
- npm: 10.9.4
- git: 2.49.0
- Date: October 14, 2025

## Step 1: Create Feature Branch

```bash
# Create and checkout new branch
git checkout -b fix/industrial-readiness

# Verify branch
git branch --show-current
```

## Step 2: Stage All Changes

```bash
# Add all new files
git add .

# Check status
git status
```

## Step 3: Commit Industrial Hardening

```bash
# Commit with detailed message
git commit -m "feat: implement industrial-grade hardening (9 workstreams)

Workstream 1: Branch & Baseline
- Environment: Node 20.19.3, npm 10.9.4, git 2.49.0
- Created artifacts/ directory structure

Workstream 2: Reproducible Build Core
- scripts/reproducible-build.sh with SOURCE_DATE_EPOCH
- Deterministic builds with stable SHA256 hashes

Workstream 3: Supply-Chain Tooling
- scripts/generate-cyclonedx-sbom.sh (CycloneDX SBOM)
- scripts/cosign-publish.sh (OIDC keyless + key-based fallback)
- ci/verify-sbom-and-cosign.sh (signature verification)
- scripts/provenance/attest-oci.js (SLSA in-toto format)

Workstream 4: Zero-Trust Pipeline
- .github/workflows/publish.yml (OIDC, no long-lived secrets)
- Conditional signing with remediation instructions

Workstream 5: Policy Gatekeeping
- opa/policies/deny-privileged.rego (security policies)
- k8s/gatekeeper/constraints-image-signature.yaml
- CI policy validation job

Workstream 6: Progressive Delivery
- helm/values-canary.yaml (traffic weights, metrics)
- helm/templates/canary-config.yaml
- .github/workflows/canary-flagger.yml (auto-promote/rollback)

Workstream 7: Observability Hardening
- tools/log-trace-correlation.js (OpenTelemetry trace_id)
- monitoring/tempo-loki-stack.md (observability stack)
- Server logger updated with trace context

Workstream 8: Runtime Security
- docs/distroless-migration.md (non-root, distroless)
- k8s/admission/sbom-verify-admission.yaml

Workstream 9: Developer & Audit
- .devcontainer/ (Node 20, cosign, OPA, Playwright)
- README.local.md (local dev setup)
- .github/workflows/audit.yml (Trivy, npm audit)

BREAKING CHANGE: Adds required security tooling (cosign, OPA, Trivy)
Refs: #INDUSTRIAL-001"
```

## Step 4: Push to Remote

```bash
# Push feature branch
git push -u origin fix/industrial-readiness
```

## Step 5: Create Pull Request

```bash
# Use GitHub CLI to create PR
gh pr create \
  --title "feat: Industrial-Grade Hardening (9 Workstreams)" \
  --body-file PR_BODY_INDUSTRIAL.md \
  --base main \
  --label "security,devops,enhancement"
```

## Alternative: Manual PR Creation

1. Go to: https://github.com/YOUR_ORG/ybuilt/compare/fix/industrial-readiness
2. Use content from `PR_BODY_INDUSTRIAL.md` as PR description
3. Add labels: `security`, `devops`, `enhancement`
4. Request review from: @security-team, @devops-team

---

## Post-Merge Steps

```bash
# After PR is merged, update main and delete feature branch
git checkout main
git pull origin main
git branch -d fix/industrial-readiness
git push origin --delete fix/industrial-readiness
```

## Verification Commands

```bash
# Verify all scripts are executable
find scripts ci -type f -name "*.sh" -exec ls -lh {} \;

# Test reproducible build
./scripts/reproducible-build.sh

# Generate SBOM
./scripts/generate-cyclonedx-sbom.sh

# Dry-run cosign (without secrets)
./scripts/cosign-publish.sh --dry-run

# Validate OPA policies
npx opa eval -d opa/policies --input {} "data.deny_privileged"

# Run E2E tests
npm run test:e2e
```
