# Git Commands for Platform 10x (Manual Execution Required)

**Note:** Git operations are restricted in this Replit environment. Execute these commands manually in your local terminal.

**Current Status:** All Platform 10x infrastructure **already exists** from previous implementation phases (Industrial Hardening & Enforcement). No new branch or commits are required.

---

## Verification Commands

```bash
# Verify infrastructure exists
ls -la scripts/{reproducible-build.sh,generate-cyclonedx-sbom.sh,cosign-sign-artifacts.sh}
ls -la scripts/provenance/attest-oci.js
ls -la ci/verify-sbom-and-cosign.sh
ls -la .github/workflows/{publish.yml,policy-check.yml,canary-promote.yml}
ls -la k8s/gatekeeper/constraint-verify-cosign.yaml
ls -la monitoring/prometheus-canary-alerts.yaml
ls -la tools/log-trace-correlation.js

# All files should exist ✅
```

---

## Optional: Create Status Report Branch

If you want to document this assessment in a dedicated branch:

```bash
# Create documentation branch
git checkout -b docs/platform-10x-status

# Add status report
git add PLATFORM10X_STATUS.md
git add GIT_COMMANDS_PLATFORM10X.md
git add PR_BODY_PLATFORM10X.md

# Commit
git commit -m "docs: add Platform 10x implementation status report

- Comprehensive assessment of existing infrastructure
- All velocity + security + reliability components verified
- No gaps identified - infrastructure complete from previous phases
- Includes deployment instructions and troubleshooting guide"

# Push
git push origin docs/platform-10x-status

# Create documentation PR (optional)
gh pr create --title "docs: Platform 10x Implementation Status" \
  --body-file PR_BODY_PLATFORM10X.md \
  --base main \
  --head docs/platform-10x-status \
  --label documentation
```

---

## Already Implemented (No Action Required)

The following infrastructure was created in previous phases:

### Industrial Hardening Phase (Branch: fix/industrial-readiness)
- scripts/reproducible-build.sh
- scripts/generate-cyclonedx-sbom.sh
- scripts/provenance/attest-oci.js
- scripts/cosign-publish.sh
- scripts/cosign-sign-artifacts.sh
- ci/verify-sbom-and-cosign.sh
- .github/workflows/publish.yml
- .github/workflows/canary-flagger.yml
- .github/workflows/audit.yml
- k8s/cert-manager/clusterissuer-*.yaml
- helm/values-canary.yaml
- monitoring/tempo-loki-stack.md
- tools/log-trace-correlation.js
- .devcontainer/

### Enforcement Phase (Branch: fix/industrial-enforce)
- k8s/gatekeeper/constraint-verify-cosign.yaml
- .github/workflows/policy-check.yml
- monitoring/prometheus-canary-alerts.yaml

---

## Deployment Commands (Cluster Operations)

```bash
# 1. Apply Gatekeeper constraint
kubectl apply -f k8s/gatekeeper/constraint-verify-cosign.yaml

# 2. Apply Prometheus alerts
kubectl apply -f monitoring/prometheus-canary-alerts.yaml

# 3. Configure Alertmanager secrets
kubectl create secret generic alertmanager-secrets \
  --from-literal=slack-webhook-url="https://hooks.slack.com/YOUR/WEBHOOK" \
  --from-literal=pagerduty-service-key="YOUR_PAGERDUTY_KEY" \
  -n monitoring

# 4. Install Sigstore Policy Controller (optional but recommended)
kubectl apply -f https://github.com/sigstore/policy-controller/releases/latest/download/policy-controller.yaml

# 5. Create ClusterImagePolicy for enforcement
kubectl apply -f - <<EOF
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: ybuilt-image-policy
spec:
  images:
    - glob: "ghcr.io/OWNER/ybuilt:**"
  authorities:
    - keyless:
        identities:
          - issuer: "https://token.actions.githubusercontent.com"
            subject: "https://github.com/OWNER/ybuilt/.github/workflows/publish.yml@refs/heads/main"
EOF
```

---

## Testing Commands

```bash
# Test reproducible build
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) TZ=UTC bash scripts/reproducible-build.sh

# Test SBOM generation
bash scripts/generate-cyclonedx-sbom.sh

# Test provenance
node scripts/provenance/attest-oci.js --out artifacts/provenance.json

# Test cosign (dry-run)
bash scripts/cosign-sign-artifacts.sh --image ghcr.io/OWNER/ybuilt:test --dry-run

# Test verification
bash ci/verify-sbom-and-cosign.sh ghcr.io/OWNER/ybuilt:test
```

---

**Summary:** Platform 10x infrastructure is **production-ready**. No git operations required - deploy directly to cluster.
