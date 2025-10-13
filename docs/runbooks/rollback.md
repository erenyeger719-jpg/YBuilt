# Rollback Runbook

## Overview
This runbook provides step-by-step instructions for rolling back YBUILT deployments in various scenarios.

## Quick Reference

| Scenario | Command | Time to Execute |
|----------|---------|----------------|
| Kubernetes rollback | `kubectl rollout undo deployment/ybuilt` | ~30 seconds |
| Helm rollback | `helm rollback ybuilt` | ~1 minute |
| GitHub release revert | `gh release delete vX.Y.Z` | ~10 seconds |
| Canary rollback | `bash scripts/rollback.sh kubernetes` | ~1 minute |

## Prerequisites

- [ ] Access to Kubernetes cluster (kubeconfig configured)
- [ ] Helm CLI installed (v3.12+)
- [ ] GitHub CLI installed (for release management)
- [ ] `kubectl` CLI installed
- [ ] Appropriate RBAC permissions

## Rollback Scenarios

### 1. Automated Canary Rollback

**When:** Canary deployment fails automated metric checks

**Process:** Automatic via GitHub Actions

The canary promotion workflow automatically rolls back if:
- Error rate > 150% of stable
- p95 latency > 130% of stable  
- Synthetic check success rate < 95%

**Manual Trigger:**
```bash
# Trigger rollback workflow
gh workflow run canary-promote.yml \
  -f action=rollback
```

### 2. Kubernetes Deployment Rollback

**When:** Issues detected in production deployment

**Steps:**

1. **Check rollout status**
   ```bash
   kubectl rollout status deployment/ybuilt -n production
   kubectl rollout history deployment/ybuilt -n production
   ```

2. **Rollback to previous revision**
   ```bash
   kubectl rollout undo deployment/ybuilt -n production
   ```

3. **Rollback to specific revision**
   ```bash
   # List revisions
   kubectl rollout history deployment/ybuilt -n production
   
   # Rollback to revision N
   kubectl rollout undo deployment/ybuilt -n production --to-revision=N
   ```

4. **Verify rollback**
   ```bash
   kubectl rollout status deployment/ybuilt -n production
   kubectl get pods -n production -l app=ybuilt
   ```

5. **Check application health**
   ```bash
   kubectl port-forward -n production svc/ybuilt 8080:80
   curl http://localhost:8080/api/status
   ```

### 3. Helm Release Rollback

**When:** Need to rollback to previous Helm chart version

**Steps:**

1. **List release history**
   ```bash
   helm history ybuilt -n production
   ```

2. **Rollback to previous release**
   ```bash
   helm rollback ybuilt -n production
   ```

3. **Rollback to specific revision**
   ```bash
   helm rollback ybuilt N -n production
   ```

4. **Verify rollback**
   ```bash
   helm status ybuilt -n production
   kubectl get all -n production -l app.kubernetes.io/instance=ybuilt
   ```

### 4. GitHub Release Rollback

**When:** Bad release published to GitHub/GHCR

**Steps:**

1. **List recent releases**
   ```bash
   gh release list --limit 10
   ```

2. **Delete problematic release**
   ```bash
   gh release delete vX.Y.Z --yes
   ```

3. **Re-tag previous version as latest (if needed)**
   ```bash
   git tag -f latest <previous-commit-sha>
   git push origin latest --force
   ```

4. **Re-run release workflow for previous version**
   ```bash
   git checkout <previous-commit-sha>
   gh workflow run release.yml
   ```

### 5. Container Image Rollback

**When:** Specific container image causing issues

**Steps:**

1. **List recent images**
   ```bash
   # Using GitHub Container Registry
   gh api \
     -H "Accept: application/vnd.github+json" \
     /user/packages/container/ybuilt/versions \
     | jq '.[] | {id, name, updated_at}'
   ```

2. **Update deployment to use previous image**
   ```bash
   kubectl set image deployment/ybuilt \
     ybuilt=ghcr.io/OWNER/ybuilt:PREVIOUS_SHA \
     -n production
   ```

3. **Verify image update**
   ```bash
   kubectl rollout status deployment/ybuilt -n production
   kubectl describe pod -n production -l app=ybuilt | grep Image:
   ```

### 6. Database Migration Rollback

**When:** Database schema changes need to be reverted

⚠️ **CRITICAL:** Always backup before rolling back migrations!

**Steps:**

1. **Backup current database**
   ```bash
   # For PostgreSQL
   pg_dump -h $DB_HOST -U $DB_USER -d ybuilt > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Check migration history**
   ```bash
   # Using Drizzle (if applicable)
   npx drizzle-kit check
   ```

3. **Rollback migration**
   ```bash
   # Manual rollback - run down migration script
   psql -h $DB_HOST -U $DB_USER -d ybuilt < migrations/down/XXXX_rollback.sql
   ```

4. **Verify schema**
   ```bash
   psql -h $DB_HOST -U $DB_USER -d ybuilt -c "\dt"
   ```

## Emergency Rollback Workflow

For critical production issues requiring immediate rollback:

### Option A: Using GitHub Actions (Recommended)

```bash
# Trigger emergency rollback workflow
gh workflow run emergency-rollback.yml \
  -f target=kubernetes \
  -f namespace=production
```

### Option B: Using Scripts (Direct)

```bash
# Clone repository
git clone https://github.com/OWNER/ybuilt.git
cd ybuilt

# Run rollback script
chmod +x scripts/rollback.sh
./scripts/rollback.sh kubernetes production
```

### Option C: Manual kubectl (Fastest)

```bash
# Immediate rollback
kubectl rollout undo deployment/ybuilt -n production

# Scale down if needed (nuclear option)
kubectl scale deployment/ybuilt -n production --replicas=0
```

## Post-Rollback Checklist

After any rollback:

- [ ] **Verify application is healthy**
  - Check `/api/status` endpoint
  - Review error logs
  - Monitor key metrics for 15 minutes

- [ ] **Notify stakeholders**
  - Post to #ybuilt-deployments Slack channel
  - Update status page if applicable
  - Create incident post-mortem ticket

- [ ] **Capture diagnostics**
  ```bash
  kubectl logs -n production deployment/ybuilt --previous > rollback_logs.txt
  kubectl describe pod -n production -l app=ybuilt > rollback_pod_status.txt
  ```

- [ ] **Root cause analysis**
  - Review application logs
  - Check metrics dashboard
  - Examine recent commits
  - Create fix for identified issue

- [ ] **Update runbooks**
  - Document new failure modes
  - Add prevention steps
  - Update monitoring/alerts

## Rollback Decision Matrix

| Severity | Response Time | Rollback Method | Approval Required |
|----------|--------------|-----------------|-------------------|
| P1 - Critical outage | Immediate | kubectl rollout undo | No (auto or on-call) |
| P2 - Degraded service | < 15 min | Helm rollback | Team lead approval |
| P3 - Minor issues | < 1 hour | Scheduled rollback | Product owner approval |
| P4 - Non-urgent | Next deploy | Include in next release | Standard review |

## Prevention Strategies

To minimize rollback needs:

1. **Always use canary deployments** for production changes
2. **Run full E2E test suite** before promoting canary
3. **Monitor SLOs** during canary observation window
4. **Implement feature flags** for risky changes
5. **Maintain rollback-safe database migrations** (additive only)
6. **Test rollback procedures** regularly (chaos engineering)

## Contact Information

- **On-call Engineer:** Check PagerDuty
- **Platform Team Lead:** Slack @platform-team
- **Emergency Escalation:** #ybuilt-incidents

## References

- [Canary Deployment Workflow](../../.github/workflows/canary-promote.yml)
- [Emergency Rollback Workflow](../../.github/workflows/emergency-rollback.yml)
- [Rollback Script](../../scripts/rollback.sh)
- [SLO Definitions](../slos.md)
- [Prometheus Alerts](../../prometheus/alerts.yaml)

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-13 | 1.0 | Initial runbook | Platform Team |
