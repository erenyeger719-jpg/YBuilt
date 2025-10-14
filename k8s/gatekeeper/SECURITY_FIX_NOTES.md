# Security Fix Notes - Gatekeeper Policy

## CRITICAL: Signature Verification Bypass

**Issue:** The current `K8sRequireCosignSignature` constraint only checks for annotation presence:

```rego
has_signature_annotation {
  input.review.object.metadata.annotations["cosign.sigstore.dev/signature"]
}
```

**Problem:** An attacker can add the annotation without a valid signature, bypassing the policy.

## Remediation Options

### Option 1: Use Policy Controller (Recommended)
Install Sigstore Policy Controller which performs actual signature verification:

```bash
kubectl apply -f https://github.com/sigstore/policy-controller/releases/latest/download/policy-controller.yaml
```

Configure ClusterImagePolicy:
```yaml
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: ybuilt-image-policy
spec:
  images:
    - glob: "ghcr.io/OWNER/ybuilt:**"
  authorities:
    - keyless:
        url: https://fulcio.sigstore.dev
        identities:
          - issuer: https://token.actions.githubusercontent.com
            subject: https://github.com/OWNER/ybuilt/.github/workflows/publish.yml@refs/heads/main
```

### Option 2: External Verification Webhook
Create a mutating/validating webhook that calls `cosign verify` before admission.

### Option 3: Enhanced Gatekeeper with External Data
Use Gatekeeper External Data Provider to query cosign verification service:

```rego
package k8srequirecosignsignature

import future.keywords.contains

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not exempt_image(container.image)
  
  # Call external cosign verification service
  response := http.send({
    "method": "POST",
    "url": "http://cosign-verifier.ybuilt-system.svc/verify",
    "headers": {"Content-Type": "application/json"},
    "body": {"image": container.image}
  })
  
  response.body.verified != true
  msg := sprintf("Container image '%s' signature verification failed: %s", [container.image, response.body.reason])
}
```

## Current Mitigation

Until proper verification is implemented:
1. Set `enforcementAction: warn` instead of `deny` for K8sRequireCosignSignature
2. Use other policies (deny root, deny privileged) as primary security gates
3. Implement proper verification before enforcing signature checks

## Timeline
- **Immediate:** Switch to warn mode
- **Week 1:** Deploy Policy Controller or external verifier
- **Week 2:** Re-enable deny mode with actual verification
