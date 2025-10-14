# Industrial Readiness Guide

Step-by-step guide for deploying and operating YBUILT with industrial-grade security and DevOps practices.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Supply Chain Security](#supply-chain-security)
3. [Zero-Trust CI/CD](#zero-trust-cicd)
4. [Policy Enforcement](#policy-enforcement)
5. [Progressive Delivery](#progressive-delivery)
6. [Observability Stack](#observability-stack)
7. [Runtime Security](#runtime-security)
8. [Developer Workflow](#developer-workflow)
9. [Security Auditing](#security-auditing)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Kubernetes cluster (v1.25+)
- kubectl configured
- Helm 3 installed
- GitHub repository with Actions enabled
- Container registry access (ghcr.io)

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/YOUR_ORG/ybuilt.git
cd ybuilt

# Checkout industrial hardening branch
git checkout fix/industrial-readiness

# Install dependencies
npm ci

# Make scripts executable
chmod +x scripts/*.sh ci/*.sh
```

### 2. Local Verification

```bash
# Run reproducible build
./scripts/reproducible-build.sh

# Generate SBOM
./scripts/generate-cyclonedx-sbom.sh

# Test cosign signing (dry-run)
./scripts/cosign-publish.sh --dry-run

# Validate OPA policies
npx opa eval -d opa/policies "data"

# Run E2E tests
npm run test:e2e
```

---

## Supply Chain Security

### SBOM Generation

**Purpose:** Generate Software Bill of Materials for transparency and compliance.

```bash
# Generate SBOM (CycloneDX format)
./scripts/generate-cyclonedx-sbom.sh

# Output: artifacts/sbom.json
```

**View SBOM:**
```bash
# List all components
jq '.components[] | {name: .name, version: .version}' artifacts/sbom.json

# Count components
jq '.components | length' artifacts/sbom.json

# Find specific package
jq '.components[] | select(.name == "express")' artifacts/sbom.json
```

### Cosign Signing

**Purpose:** Sign artifacts for authenticity and integrity.

#### Option 1: OIDC Keyless (GitHub Actions)

Automatically enabled when:
- Running in GitHub Actions
- `permissions.id-token: write` is set

```yaml
# .github/workflows/publish.yml
permissions:
  id-token: write
  packages: write
  contents: write
```

#### Option 2: Key-Based (Local/Manual)

```bash
# Generate key pair (first time)
cosign generate-key-pair

# Set environment variable
export COSIGN_KEY=cosign.key
export COSIGN_PASSWORD=your-password

# Sign artifact
./scripts/cosign-publish.sh \
  artifacts/dist.tar.gz \
  artifacts/sbom.json \
  artifacts/provenance.json
```

**Add COSIGN_KEY to GitHub Secrets:**
```bash
# 1. Copy cosign.key content
cat cosign.key

# 2. Go to: Settings → Secrets → Actions → New repository secret
#    Name: COSIGN_KEY
#    Value: <paste cosign.key content>
```

### Provenance Attestation

**Purpose:** Record build environment and dependencies (SLSA v0.2).

```bash
# Generate provenance
node scripts/provenance/attest-oci.js \
  --artifact=artifacts/dist.tar.gz \
  --out=artifacts/provenance.json

# View provenance
jq . artifacts/provenance.json

# Extract key information
jq '.predicate.builder.id' artifacts/provenance.json
jq '.predicate.materials' artifacts/provenance.json
```

### Verification

```bash
# Verify all artifacts
./ci/verify-sbom-and-cosign.sh

# Check SBOM hash
EXPECTED=$(cat artifacts/sbom.json.sha256)
ACTUAL=$(sha256sum artifacts/sbom.json | awk '{print $1}')
[ "$EXPECTED" == "$ACTUAL" ] && echo "✅ SBOM verified"

# Verify cosign signature (if signed)
cosign verify-blob \
  --bundle artifacts/cosign.bundle \
  artifacts/dist.tar.gz
```

---

## Zero-Trust CI/CD

### GitHub Actions Setup

**1. Enable OIDC (Recommended)**

No additional setup required! GitHub Actions automatically provides OIDC tokens when:

```yaml
permissions:
  id-token: write  # This enables OIDC
```

**2. Configure Secrets (Fallback)**

If OIDC is unavailable:

```bash
# Generate cosign key pair
cosign generate-key-pair

# Add to GitHub Secrets:
# - COSIGN_KEY: <contents of cosign.key>
# - COSIGN_PASSWORD: <your password>
```

### Release Workflow

**Trigger:** Push tag `v*.*.*`

```bash
# Create and push tag
git tag v1.0.0
git push origin v1.0.0

# Workflow runs:
# 1. Reproducible build → artifacts/dist.tar.gz
# 2. Generate SBOM → artifacts/sbom.json
# 3. Generate provenance → artifacts/provenance.json
# 4. Sign with cosign → OIDC or key-based
# 5. Verify artifacts → comprehensive validation
# 6. Create release → GitHub release with all artifacts
```

**Check Status:**
```bash
# View workflow runs
gh run list --workflow=publish.yml

# Watch live logs
gh run watch
```

### Remediation for Unsigned Artifacts

If signing fails, workflow creates `UNSIGNED.json` with instructions:

```json
{
  "signed": false,
  "reason": "no_signing_method",
  "remediation": [
    "Enable OIDC: permissions.id-token = write",
    "OR add COSIGN_KEY secret to GitHub"
  ]
}
```

**⚠️ DO NOT use unsigned artifacts in production!**

---

## Policy Enforcement

### OPA Policies

**Location:** `opa/policies/deny-privileged.rego`

**Policies:**
1. Deny privileged containers
2. Deny root execution
3. Require cosign signatures
4. Block banned packages in SBOM
5. Require resource limits
6. Require read-only root filesystem
7. Deny dangerous capabilities
8. Require namespace labels (warn only)

**Local Testing:**

```bash
# Validate policy syntax
npx opa check opa/policies/deny-privileged.rego

# Test against example pod
cat > test-pod.json <<EOF
{
  "request": {
    "kind": {"kind": "Pod"},
    "object": {
      "spec": {
        "containers": [{
          "name": "nginx",
          "image": "nginx",
          "securityContext": {
            "privileged": true
          }
        }]
      }
    }
  }
}
EOF

npx opa eval -d opa/policies \
  --input test-pod.json \
  "data.kubernetes.admission.deny_privileged"

# Expected: "Privileged container 'nginx' is not allowed"
```

### Gatekeeper Deployment

**1. Install Gatekeeper:**

```bash
kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/release-3.14/deploy/gatekeeper.yaml

# Wait for deployment
kubectl wait --for=condition=available --timeout=60s \
  deployment/gatekeeper-controller-manager \
  -n gatekeeper-system
```

**2. Apply Constraint Templates:**

```bash
kubectl apply -f k8s/gatekeeper/constraints-image-signature.yaml

# Verify templates
kubectl get constrainttemplates
```

**3. Test Enforcement:**

```bash
# Try to create privileged pod (should fail)
cat > privileged-pod.yaml <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: privileged-test
spec:
  containers:
  - name: nginx
    image: nginx
    securityContext:
      privileged: true
EOF

kubectl apply -f privileged-pod.yaml
# Expected: Error from Gatekeeper: "Privileged container 'nginx' is not allowed"
```

---

## Progressive Delivery

### Flagger Setup

**1. Install Flagger:**

```bash
# Add Flagger Helm repo
helm repo add flagger https://flagger.app
helm repo update

# Install Flagger (with Istio)
kubectl apply -k github.com/fluxcd/flagger//kustomize/istio

# Verify installation
kubectl get pods -n flagger-system
```

**2. Deploy Canary:**

```bash
# Deploy with canary enabled
helm upgrade --install ybuilt ./helm \
  --namespace production \
  --values helm/values-canary.yaml \
  --set canary.enabled=true \
  --set canary.weights.initial=10 \
  --set deployment.canary.image.tag=v1.1.0

# Watch canary progress
kubectl get canary ybuilt -n production -w
```

**3. Monitor Metrics:**

```bash
# Check canary status
kubectl describe canary ybuilt -n production

# View traffic weights
kubectl get canary ybuilt -n production \
  -o jsonpath='{.status.canaryWeight}'

# Check analysis results
kubectl get canary ybuilt -n production \
  -o jsonpath='{.status.conditions[?(@.type=="Promoted")].message}'
```

### Canary Workflow (GitHub Actions)

**Deploy Canary:**

```bash
# Trigger workflow
gh workflow run canary-flagger.yml \
  -f weight=10 \
  -f action=deploy

# Or use GitHub UI: Actions → Canary Deployment → Run workflow
```

**Manual Promotion:**

```bash
gh workflow run canary-flagger.yml \
  -f action=promote
```

**Manual Rollback:**

```bash
gh workflow run canary-flagger.yml \
  -f action=rollback
```

---

## Observability Stack

### Deploy Tempo (Tracing)

```bash
# Add Grafana Helm repo
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Tempo
helm install tempo grafana/tempo \
  --namespace observability \
  --create-namespace \
  --set tempo.retention=72h \
  --set tempo.storage.trace.backend=s3 \
  --set tempo.storage.trace.s3.bucket=ybuilt-tempo-traces
```

### Deploy Loki (Logging)

```bash
# Install Loki stack
helm install loki grafana/loki-stack \
  --namespace observability \
  --set loki.persistence.enabled=true \
  --set loki.persistence.size=50Gi \
  --set promtail.enabled=true
```

### Deploy Grafana

```bash
# Install Grafana
helm install grafana grafana/grafana \
  --namespace observability \
  --set persistence.enabled=true \
  --set adminPassword=admin

# Get Grafana URL
kubectl port-forward -n observability svc/grafana 3000:80

# Access: http://localhost:3000
# Login: admin / admin
```

### Configure Data Sources

```bash
# Apply data source config
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: observability
data:
  datasources.yaml: |
    apiVersion: 1
    datasources:
      - name: Tempo
        type: tempo
        access: proxy
        url: http://tempo.observability:3200
      - name: Loki
        type: loki
        access: proxy
        url: http://loki.observability:3100
      - name: Prometheus
        type: prometheus
        access: proxy
        url: http://prometheus.monitoring:9090
EOF
```

### Application Integration

**Update server logger:**

```typescript
// server/index.ts
import { createTraceAwareLogger } from '../tools/log-trace-correlation';

const logger = createTraceAwareLogger('ybuilt-api');

// Add middleware
app.use(logger.middleware());

// Use in routes
app.get('/api/jobs/:id', async (req, res) => {
  logger.info('Fetching job', {
    job_id: req.params.id,
    user_id: req.user?.id,
    // trace_id automatically included
  });
  
  // ... handler logic
});
```

---

## Runtime Security

### Distroless Migration

**1. Update Dockerfile:**

```dockerfile
# Stage 1: Builder
FROM node:20-bullseye AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit
COPY . .
RUN npm run build && npm prune --omit=dev

# Stage 2: Runtime (Distroless)
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json
EXPOSE 5000
USER nonroot
CMD ["dist/index.js"]
```

**2. Update Kubernetes Deployment:**

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 65532
    fsGroup: 65532
  
  containers:
  - name: ybuilt
    image: ghcr.io/ybuilt/ybuilt:distroless
    
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
    
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  
  volumes:
  - name: tmp
    emptyDir: {}
```

**3. Verify:**

```bash
# Build distroless image
docker build -t ybuilt:distroless .

# Scan for vulnerabilities
trivy image ybuilt:distroless

# Expected: 0 critical, 0 high vulnerabilities
```

### SBOM Verification Admission Webhook

**1. Install cert-manager:**

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

**2. Deploy webhook:**

```bash
# Create namespace
kubectl create namespace ybuilt-system

# Apply admission webhook
kubectl apply -f k8s/admission/sbom-verify-admission.yaml

# Verify webhook is running
kubectl get pods -n ybuilt-system
```

**3. Enable for namespace:**

```bash
# Label namespace to enable webhook
kubectl label namespace production sbom-verify=enabled

# Test with unsigned image (should fail)
kubectl run test --image=nginx -n production
# Expected: Admission webhook denied request
```

---

## Developer Workflow

### Dev Container Setup

**VS Code:**

```bash
# 1. Install "Dev Containers" extension
# 2. Open project in VS Code
code .

# 3. Click "Reopen in Container" when prompted
# ✅ All tools installed: Node 20, cosign, OPA, Trivy, Playwright
```

**Manual Setup (without dev container):**

See `README.local.md` for complete manual setup instructions.

### Local Testing

```bash
# Start application
npm run dev

# Run tests
npm test                # Unit tests
npm run test:e2e        # E2E tests
npm run coverage        # Coverage report

# Supply chain workflows
./scripts/reproducible-build.sh
./scripts/generate-cyclonedx-sbom.sh
./scripts/cosign-publish.sh --dry-run

# Policy validation
npx opa eval -d opa/policies "data"

# Security scanning
npm audit --json > artifacts/npm-audit.json
trivy image ybuilt:local
```

---

## Security Auditing

### Automated Audits (Daily)

**Workflow:** `.github/workflows/audit.yml`

Runs daily at 2 AM UTC:
1. npm dependency audit
2. Docker image scan (Trivy)
3. SBOM package audit
4. Dependency review (PRs only)

**Auto-creates issues** for high/critical vulnerabilities.

### Manual Audit

```bash
# npm audit
npm audit --json > artifacts/npm-audit.json

# View critical/high vulnerabilities
jq '[.vulnerabilities[] | select(.severity == "critical" or .severity == "high")]' artifacts/npm-audit.json

# Trivy scan
docker build -t ybuilt:scan .
trivy image ybuilt:scan \
  --severity HIGH,CRITICAL \
  --format json \
  --output artifacts/vuln-report.json

# View critical vulnerabilities
jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")]' artifacts/vuln-report.json
```

### Remediation

```bash
# Fix npm vulnerabilities
npm audit fix

# Update specific package
npm update package-name

# Force update (breaking changes)
npm update --force package-name

# Rebuild Docker image with latest base
docker build --pull -t ybuilt:latest .
```

---

## Troubleshooting

### SBOM Generation Fails

**Issue:** `npm ls` errors or missing packages

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm ci

# Retry SBOM generation
./scripts/generate-cyclonedx-sbom.sh
```

### Cosign Not Found

**Issue:** `cosign: command not found`

**Solution:**
```bash
# macOS
brew install cosign

# Linux
curl -sLO https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
sudo mv cosign-linux-amd64 /usr/local/bin/cosign
sudo chmod +x /usr/local/bin/cosign
```

### Canary Stuck in Progressing

**Issue:** Canary not promoting or rolling back

**Solution:**
```bash
# Check metrics
kubectl logs -n flagger-system deployment/flagger -f

# Check Prometheus metrics
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Force promotion
kubectl patch canary ybuilt -n production \
  --type merge \
  -p '{"spec":{"skipAnalysis":true}}'

# Force rollback
kubectl patch canary ybuilt -n production \
  --type merge \
  -p '{"spec":{"analysis":{"maxWeight":0}}}'
```

### Gatekeeper Blocking Legitimate Pods

**Issue:** Gatekeeper denying valid pods

**Solution:**
```bash
# Check constraint violations
kubectl get K8sRequireCosignSignature -A

# Temporarily disable constraint
kubectl patch K8sRequireCosignSignature require-cosign-signature \
  --type merge \
  -p '{"spec":{"enforcementAction":"dryrun"}}'

# Exempt specific namespace
kubectl patch K8sRequireCosignSignature require-cosign-signature \
  --type merge \
  -p '{"spec":{"parameters":{"exemptNamespaces":["development","testing"]}}}'
```

### GitHub Actions OIDC Fails

**Issue:** "OIDC token not available"

**Solution:**
```yaml
# Check permissions in workflow
permissions:
  id-token: write  # MUST be set

# Fallback to key-based signing
# Add COSIGN_KEY secret to repository
```

---

## Next Steps

### Post-Deployment

1. ✅ Monitor canary deployments
2. ✅ Review audit workflow results
3. ✅ Configure alerting rules
4. ✅ Set up Slack notifications

### Long-Term

1. 📋 Implement automated security patching
2. 📋 Add runtime security monitoring (Falco)
3. 📋 Implement chaos engineering tests
4. 📋 Add compliance reporting (SOC2, ISO 27001)

---

## Resources

- [OPA Policy Language](https://www.openpolicyagent.org/docs/latest/policy-language/)
- [Cosign Documentation](https://docs.sigstore.dev/cosign/overview/)
- [Flagger Progressive Delivery](https://flagger.app/)
- [Grafana Tempo](https://grafana.com/oss/tempo/)
- [Google Distroless](https://github.com/GoogleContainerTools/distroless)
- [SLSA Framework](https://slsa.dev/)
