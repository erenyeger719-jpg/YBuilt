# Distroless Migration Guide

Guide for migrating YBUILT to Google's Distroless base images for enhanced security and reduced attack surface.

## Why Distroless?

**Benefits:**
- ✅ **Minimal Attack Surface**: No shell, package managers, or unnecessary tools
- ✅ **Smaller Images**: ~50-80% size reduction vs. debian/alpine
- ✅ **Security**: No CVEs from unused packages
- ✅ **Non-Root by Default**: Runs as USER 65532 (nonroot)

**Trade-offs:**
- ❌ No shell access for debugging (use debug variants temporarily)
- ❌ Requires multi-stage builds
- ❌ Can't `docker exec` into running containers

---

## Current Dockerfile (Before Migration)

```dockerfile
FROM node:20-bullseye
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["node", "dist/index.js"]
```

**Issues:**
- ❌ Runs as root (UID 0)
- ❌ Contains unnecessary packages (apt, curl, etc.)
- ❌ Large image size (~900MB)

---

## Migrated Dockerfile (Distroless)

```dockerfile
# Stage 1: Builder
FROM node:20-bullseye AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build application
RUN npm run build && \
    npm prune --omit=dev

# Stage 2: Runtime (Distroless)
FROM gcr.io/distroless/nodejs20-debian12:nonroot

# Set working directory
WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json

# Expose port
EXPOSE 5000

# Run as non-root user (UID 65532)
USER nonroot

# Healthcheck (using Node.js instead of curl)
# Note: Distroless doesn't support HEALTHCHECK, define in K8s instead

# Start application
CMD ["dist/index.js"]
```

**Improvements:**
- ✅ Multi-stage build reduces final image to ~150MB
- ✅ Runs as non-root USER 65532 (nonroot)
- ✅ No shell, package managers, or unnecessary binaries
- ✅ Owned by nonroot user (no root file access)

---

## Image Size Comparison

| Base Image                          | Size   | Reduction |
|-------------------------------------|--------|-----------|
| `node:20-bullseye` (before)         | 900MB  | -         |
| `node:20-alpine`                    | 120MB  | 86.7%     |
| `gcr.io/distroless/nodejs20` (after)| 150MB  | 83.3%     |
| `gcr.io/distroless/nodejs20:debug`  | 160MB  | 82.2%     |

---

## Kubernetes Configuration Changes

### 1. Pod Security Context

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ybuilt
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532       # nonroot user from distroless
        fsGroup: 65532
        seccompProfile:
          type: RuntimeDefault
      
      containers:
      - name: ybuilt
        image: ghcr.io/ybuilt/ybuilt:latest
        
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
              - ALL
        
        # Health checks (replace curl with HTTP probes)
        livenessProbe:
          httpGet:
            path: /api/status
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /api/status
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5
        
        # Volume mounts for writable directories
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /app/.cache
      
      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}
```

### 2. Read-Only Root Filesystem

Since distroless images run with `readOnlyRootFilesystem: true`, mount writable volumes for:

- `/tmp` - Temporary files
- `/app/data` - Application data (if not using external storage)
- `/app/.cache` - Cache directory

---

## Debugging Distroless Containers

### Option 1: Use Debug Variant (Temporary)

```dockerfile
# Use debug image temporarily
FROM gcr.io/distroless/nodejs20-debian12:debug

# Now you have a shell
```

```bash
# Exec into debug container
kubectl exec -it ybuilt-pod -- sh
```

**⚠️ Remove debug variant before production deployment!**

### Option 2: Ephemeral Debug Container (K8s 1.25+)

```bash
# Attach ephemeral debug container
kubectl debug ybuilt-pod -it \
  --image=busybox \
  --target=ybuilt \
  --share-processes
```

### Option 3: kubectl cp for File Inspection

```bash
# Copy files from running container
kubectl cp ybuilt-pod:/app/dist ./dist-local
```

---

## Security Scanning

### Scan Distroless Image

```bash
# Trivy scan
trivy image gcr.io/distroless/nodejs20-debian12:nonroot

# Expected: 0 critical, 0 high vulnerabilities
```

### Compare with Previous Image

```bash
# Scan old image
trivy image node:20-bullseye

# Typical: 10-50 medium/high vulnerabilities
```

---

## Migration Checklist

### Phase 1: Preparation
- [ ] Audit application for shell dependencies (e.g., `exec('curl ...')`)
- [ ] Identify writable directories needed at runtime
- [ ] Update healthchecks to use HTTP instead of shell commands
- [ ] Test multi-stage build locally

### Phase 2: Implementation
- [ ] Update Dockerfile with distroless base
- [ ] Add volume mounts for writable directories
- [ ] Update K8s securityContext (runAsNonRoot, readOnlyRootFilesystem)
- [ ] Update CI/CD pipelines

### Phase 3: Validation
- [ ] Test image locally: `docker run --rm ybuilt:distroless`
- [ ] Verify file permissions: `docker run --rm ybuilt:distroless ls -la`
- [ ] Deploy to staging environment
- [ ] Run E2E tests
- [ ] Scan for vulnerabilities: `trivy image ybuilt:distroless`

### Phase 4: Production Rollout
- [ ] Canary deployment (10% traffic)
- [ ] Monitor for errors (check logs for EACCES, ENOENT)
- [ ] Gradual rollout (20% → 50% → 100%)
- [ ] Remove debug images from registry

---

## Troubleshooting

### Issue: EACCES (Permission Denied)

**Cause**: Application trying to write to read-only filesystem

**Solution**: Mount writable volume

```yaml
volumeMounts:
- name: data
  mountPath: /app/data
```

### Issue: ENOENT (File Not Found)

**Cause**: Missing file in final image

**Solution**: Verify COPY in Dockerfile

```dockerfile
# Ensure all runtime files are copied
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
```

### Issue: Application Crashes on Startup

**Cause**: Missing environment variable or config

**Solution**: Check ConfigMap/Secret mounts

```yaml
envFrom:
- configMapRef:
    name: ybuilt-config
```

---

## Runtime Class Configuration

For additional security, use gVisor or Kata Containers:

```yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ybuilt
spec:
  template:
    spec:
      runtimeClassName: gvisor  # Sandboxed runtime
      containers:
      - name: ybuilt
        image: gcr.io/ybuilt/ybuilt:distroless
```

---

## Pod Security Standards

Apply **Restricted** policy:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

This enforces:
- ✅ `runAsNonRoot: true`
- ✅ `readOnlyRootFilesystem: true`
- ✅ Drop all capabilities
- ✅ No privilege escalation

---

## References

- [Google Distroless Images](https://github.com/GoogleContainerTools/distroless)
- [SLSA Build Levels](https://slsa.dev/spec/v0.1/levels)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
