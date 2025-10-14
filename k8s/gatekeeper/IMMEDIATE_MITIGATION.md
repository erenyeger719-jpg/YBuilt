# CRITICAL: Immediate Gatekeeper Mitigation Steps

## Current Status
⚠️ **VULNERABLE**: The K8sRequireCosignSignature constraint is in `warn` mode because it only checks annotation presence, not actual signature validity.

## Immediate Actions Required

### Step 1: Deploy Sigstore Policy Controller (Recommended)

```bash
# Install Policy Controller
kubectl apply -f https://github.com/sigstore/policy-controller/releases/latest/download/policy-controller.yaml

# Wait for deployment
kubectl wait --for=condition=available --timeout=300s \
  deployment/policy-controller-webhook -n cosign-system

# Create ClusterImagePolicy for actual signature verification
kubectl apply -f - <<EOF
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: ybuilt-signature-policy
spec:
  images:
    - glob: "ghcr.io/*/ybuilt:**"
    - glob: "ghcr.io/*/ybuilt-*:**"
  authorities:
    - keyless:
        url: https://fulcio.sigstore.dev
        identities:
          - issuerRegExp: "https://token.actions.githubusercontent.com"
            subjectRegExp: "https://github.com/.*/ybuilt/.*"
EOF

# Verify policy is enforced
kubectl get clusterimagepolicy ybuilt-signature-policy
```

### Step 2: Remove Gatekeeper Signature Constraint

Once Policy Controller is deployed:

```bash
# Delete the insecure Gatekeeper constraint
kubectl delete k8srequirecosignsignature require-cosign-signature

# Keep other secure constraints (deny-root, deny-privileged)
kubectl get constrainttemplates
kubectl get constraints
```

### Step 3: Test Enforcement

```bash
# Try to deploy unsigned image (should FAIL)
kubectl run test-unsigned --image=nginx:latest

# Try to deploy signed YBUILT image (should SUCCEED)
kubectl run test-signed --image=ghcr.io/OWNER/ybuilt:v1.0.0
```

## Alternative: External Verification Webhook

If Policy Controller cannot be used, deploy a custom verification webhook:

```bash
# Deploy cosign verification webhook
kubectl apply -f k8s/admission/cosign-verify-webhook.yaml

# This webhook will call `cosign verify` for each pod
```

## Timeline

- **Now (Day 0)**: Gatekeeper in warn mode (logging only)
- **Day 1-3**: Deploy Sigstore Policy Controller
- **Day 4-7**: Test and validate
- **Day 8+**: Remove Gatekeeper signature constraint

## Verification

```bash
# Check Policy Controller status
kubectl get pods -n cosign-system

# View policy violations
kubectl get clusterimagepolicy -A

# Check logs
kubectl logs -n cosign-system deployment/policy-controller-webhook
```

## Risk Mitigation Until Fixed

1. **Network Policies**: Restrict image pulls to trusted registries only
2. **RBAC**: Limit who can create/update pods
3. **Namespace Isolation**: Use separate namespaces for untrusted workloads
4. **Image Scanning**: Run Trivy/Snyk in admission controller
5. **Manual Verification**: Require manual cosign verify before deployment

## Status Tracking

```bash
# Check current enforcement
kubectl get k8srequirecosignsignature require-cosign-signature -o jsonpath='{.spec.enforcementAction}'
# Expected: "warn" (until Policy Controller deployed)
# Target: Delete this constraint after Policy Controller active
```
