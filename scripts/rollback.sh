#!/bin/bash
set -e

echo "🔄 YBUILT Rollback Script"
echo ""

# Function: Rollback GitHub Release
rollback_release() {
  local TAG=$1
  echo "Rolling back release: $TAG"
  gh release delete "$TAG" --yes || true
  git tag -d "$TAG" || true
  git push origin ":refs/tags/$TAG" || true
  echo "✅ Release $TAG rolled back"
}

# Function: Rollback Kubernetes Deployment
rollback_k8s() {
  local NAMESPACE=${1:-default}
  local DEPLOYMENT=${2:-ybuilt}
  
  echo "Rolling back K8s deployment: $DEPLOYMENT in namespace: $NAMESPACE"
  kubectl rollout undo deployment/$DEPLOYMENT --namespace=$NAMESPACE
  kubectl rollout status deployment/$DEPLOYMENT --namespace=$NAMESPACE
  echo "✅ K8s deployment rolled back"
}

# Function: Rollback via Git Revert
rollback_commit() {
  local COMMIT=$1
  echo "Reverting commit: $COMMIT"
  git revert --no-edit $COMMIT
  git push origin main
  echo "✅ Commit $COMMIT reverted"
}

# Main
case ${1:-} in
  release)
    rollback_release "$2"
    ;;
  k8s)
    rollback_k8s "$2" "$3"
    ;;
  commit)
    rollback_commit "$2"
    ;;
  *)
    echo "Usage: $0 {release|k8s|commit} <args>"
    echo ""
    echo "Examples:"
    echo "  $0 release v1.2.3"
    echo "  $0 k8s default ybuilt"
    echo "  $0 commit abc123"
    exit 1
    ;;
esac
