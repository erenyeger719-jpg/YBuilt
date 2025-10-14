# Local Development Setup - YBUILT Industrial

Complete guide for setting up a local development environment with all industrial-grade tooling.

## Quick Start (Dev Container)

### Option 1: VS Code Dev Container (Recommended)

1. **Prerequisites**
   - Docker Desktop installed
   - VS Code with "Dev Containers" extension

2. **Open in Dev Container**
   ```bash
   # Clone repo
   git clone https://github.com/YOUR_ORG/ybuilt.git
   cd ybuilt
   
   # Open in VS Code
   code .
   
   # VS Code will prompt: "Reopen in Container" → Click it
   ```

3. **Start Development**
   ```bash
   # Inside dev container terminal
   npm run dev
   ```

**✅ Dev Container includes:**
- Node.js 20
- cosign (for artifact signing)
- OPA (for policy validation)
- Playwright (for E2E tests)
- Trivy (for vulnerability scanning)
- kubectl, Helm, k9s (for Kubernetes)

---

## Manual Setup (Without Dev Container)

### 1. Install System Dependencies

#### macOS
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install node@20 cosign opa trivy jq kubectl helm

# Verify installations
node --version  # Should be v20.x
cosign version
opa version
trivy --version
```

#### Linux (Ubuntu/Debian)
```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# cosign
COSIGN_VERSION="v2.2.0"
curl -sLO "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64"
sudo mv cosign-linux-amd64 /usr/local/bin/cosign
sudo chmod +x /usr/local/bin/cosign

# OPA
OPA_VERSION="v0.58.0"
curl -sLO "https://openpolicyagent.org/downloads/${OPA_VERSION}/opa_linux_amd64_static"
sudo mv opa_linux_amd64_static /usr/local/bin/opa
sudo chmod +x /usr/local/bin/opa

# Trivy
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install -y trivy

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 2. Install Node.js Dependencies

```bash
# Clone repository
git clone https://github.com/YOUR_ORG/ybuilt.git
cd ybuilt

# Install dependencies
npm ci

# Make scripts executable
chmod +x scripts/*.sh ci/*.sh

# Verify setup
npm run typecheck
npm run lint
```

### 3. Install Global Tools

```bash
# CycloneDX for SBOM generation
npm install -g @cyclonedx/cyclonedx-npm

# Playwright browsers
npx playwright install chromium firefox webkit
```

---

## Development Workflow

### Start Application

```bash
# Development mode (auto-reload)
npm run dev

# Visit: http://localhost:5000
```

### Run Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage report
npm run coverage

# Flaky test detection
node tools/flaky-detector.js --runs 10
```

### Supply Chain Workflows

#### 1. Reproducible Build

```bash
# Build with deterministic output
./scripts/reproducible-build.sh

# Verify reproducibility (run twice, hashes should match)
HASH1=$(cat artifacts/dist.tar.gz.sha256)
./scripts/reproducible-build.sh
HASH2=$(cat artifacts/dist.tar.gz.sha256)

if [ "$HASH1" == "$HASH2" ]; then
  echo "✅ Build is reproducible"
else
  echo "❌ Build is NOT reproducible"
fi
```

#### 2. Generate SBOM

```bash
# Generate Software Bill of Materials
./scripts/generate-cyclonedx-sbom.sh

# View SBOM
jq . artifacts/sbom.json | less
```

#### 3. Sign Artifacts (Local Development)

```bash
# Generate cosign key pair (first time only)
cosign generate-key-pair

# Sign artifact with local key
export COSIGN_KEY=cosign.key
./scripts/cosign-publish.sh \
  artifacts/dist.tar.gz \
  artifacts/sbom.json \
  artifacts/provenance.json

# Verify signature
./ci/verify-sbom-and-cosign.sh
```

#### 4. Dry-Run Signing (Without Keys)

```bash
# See what would happen without actual signing
./scripts/cosign-publish.sh --dry-run

# Expected output:
# ✅ DRY_RUN: Would sign with OIDC if ACTIONS_ID_TOKEN_REQUEST_TOKEN is set
# 📝 To enable OIDC keyless signing in GitHub Actions...
```

#### 5. Generate Provenance

```bash
# Create SLSA provenance attestation
node scripts/provenance/attest-oci.js \
  --artifact=artifacts/dist.tar.gz \
  --out=artifacts/provenance.json

# View provenance
jq . artifacts/provenance.json
```

### Policy Validation

#### 1. Validate OPA Policies

```bash
# Test deny-privileged policy
npx opa eval -d opa/policies \
  --input test/fixtures/privileged-pod.json \
  "data.kubernetes.admission.deny"

# Expected: Array of denial messages
```

#### 2. Test Policy Against Fixtures

```bash
# Create test fixture
cat > test-pod.json <<EOF
{
  "request": {
    "kind": {"kind": "Pod"},
    "object": {
      "spec": {
        "containers": [{
          "name": "test",
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

# Run OPA evaluation
npx opa eval -d opa/policies \
  --input test-pod.json \
  "data.kubernetes.admission.deny_privileged"

# Should return: "Privileged container 'test' is not allowed"
```

### Security Scanning

#### 1. Scan Dependencies

```bash
# npm audit (JSON output)
npm audit --json > artifacts/npm-audit.json

# View high/critical vulnerabilities
jq '.vulnerabilities | to_entries | map(select(.value.severity == "high" or .value.severity == "critical"))' artifacts/npm-audit.json
```

#### 2. Scan Docker Image

```bash
# Build image first
docker build -t ybuilt:local .

# Scan with Trivy
trivy image ybuilt:local \
  --severity HIGH,CRITICAL \
  --format json \
  --output artifacts/vuln-report.json

# View report
jq '.Results[] | select(.Vulnerabilities != null) | .Vulnerabilities[] | select(.Severity == "CRITICAL")' artifacts/vuln-report.json
```

---

## Canary Deployment (Local Kubernetes)

### 1. Setup Minikube

```bash
# Start Minikube
minikube start --cpus=4 --memory=8192

# Enable Istio (for traffic splitting)
minikube addons enable istio

# Install Flagger
kubectl apply -k github.com/fluxcd/flagger//kustomize/istio
```

### 2. Deploy Canary

```bash
# Build and push image to minikube
eval $(minikube docker-env)
docker build -t ybuilt:canary .

# Deploy with Helm
helm upgrade --install ybuilt ./helm \
  --namespace default \
  --values helm/values-canary.yaml \
  --set canary.enabled=true \
  --set canary.weights.initial=10 \
  --set deployment.canary.image.tag=canary

# Watch canary progress
kubectl get canary ybuilt -w
```

---

## Troubleshooting

### Issue: Scripts not executable

```bash
# Fix permissions
chmod +x scripts/*.sh ci/*.sh
```

### Issue: cosign not found

```bash
# macOS
brew install cosign

# Linux
curl -sLO https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
sudo mv cosign-linux-amd64 /usr/local/bin/cosign
sudo chmod +x /usr/local/bin/cosign
```

### Issue: OPA policy validation fails

```bash
# Check policy syntax
opa check opa/policies/deny-privileged.rego

# Test with example input
opa eval -d opa/policies --input test/fixtures/pod.json "data"
```

### Issue: E2E tests fail

```bash
# Install Playwright browsers
npx playwright install --with-deps

# Run with UI for debugging
npx playwright test --ui
```

### Issue: SBOM generation fails

```bash
# Install CycloneDX globally
npm install -g @cyclonedx/cyclonedx-npm

# Generate SBOM manually
npx @cyclonedx/cyclonedx-npm --output-file artifacts/sbom.json
```

---

## VS Code Extensions (Manual Install)

If not using dev container, install these extensions:

1. **ESLint** (`dbaeumer.vscode-eslint`)
2. **Prettier** (`esbenp.prettier-vscode`)
3. **Playwright Test** (`ms-playwright.playwright`)
4. **Open Policy Agent** (`tsandall.opa`)
5. **Docker** (`ms-azuretools.vscode-docker`)
6. **Kubernetes** (`ms-kubernetes-tools.vscode-kubernetes-tools`)

---

## Environment Variables

Create `.env.local`:

```bash
# Development
NODE_ENV=development
PORT=5000
LOG_LEVEL=debug

# OpenTelemetry (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=ybuilt-local

# Razorpay (mock in dev)
RAZORPAY_MODE=mock
```

---

## Verification Checklist

Before pushing code:

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (all unit tests)
- [ ] `npm run test:e2e` passes (all E2E tests)
- [ ] `./scripts/reproducible-build.sh` succeeds
- [ ] `./scripts/generate-cyclonedx-sbom.sh` creates valid SBOM
- [ ] `npx opa eval -d opa/policies` validates policies
- [ ] No high/critical vulnerabilities in `npm audit`
- [ ] Dockerfile builds successfully
- [ ] All scripts have `chmod +x` permissions

---

## Resources

- [OPA Policy Language](https://www.openpolicyagent.org/docs/latest/policy-language/)
- [Cosign Documentation](https://docs.sigstore.dev/cosign/overview/)
- [Playwright Testing](https://playwright.dev/)
- [CycloneDX SBOM](https://cyclonedx.org/)
- [Trivy Scanner](https://aquasecurity.github.io/trivy/)
