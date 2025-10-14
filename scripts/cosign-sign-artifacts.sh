#!/usr/bin/env bash
# scripts/cosign-sign-artifacts.sh
# Usage:
#   scripts/cosign-sign-artifacts.sh --image ghcr.io/OWNER/REPO:TAG [--dry-run]
#   scripts/cosign-sign-artifacts.sh --artifact artifacts/dist.tar.gz [--dry-run]
set -euo pipefail

print_usage() {
  cat <<EOF
Usage:
  $0 --image <image_ref> [--dry-run]
  $0 --artifact <path_to_file> [--dry-run]

Environment:
  COSIGN_KEY      optional (e.g. env://COSIGN_KEY) for key-based signing. If unset, keyless signing is attempted.
  SBOM_PATH       path to SBOM json (default: artifacts/sbom.json)
  PROVENANCE_PATH path to provenance json (default: artifacts/provenance.json)
EOF
}

# Defaults
SBOM_PATH="${SBOM_PATH:-artifacts/sbom.json}"
PROVENANCE_PATH="${PROVENANCE_PATH:-artifacts/provenance.json}"
DRY_RUN=false
MODE=""
TARGET=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) MODE="image"; TARGET="$2"; shift 2;;
    --artifact) MODE="artifact"; TARGET="$2"; shift 2;;
    --dry-run) DRY_RUN=true; shift;;
    -h|--help) print_usage; exit 0;;
    *) echo "Unknown arg: $1"; print_usage; exit 2;;
  esac
done

if [ -z "$MODE" ]; then
  echo "Must pass --image or --artifact"
  print_usage
  exit 2
fi

if [ ! -x "$(command -v cosign)" ]; then
  echo "cosign not found in PATH. Please install cosign (see https://github.com/sigstore/cosign) or add it to the container/devcontainer."
  exit 3
fi

echo "COSIGN_SIGN: mode=${MODE}, target=${TARGET}, dry_run=${DRY_RUN}"
if [ "$MODE" = "image" ]; then
  IMAGE_REF="${TARGET}"
  echo "Target image: ${IMAGE_REF}"
  if [ "${DRY_RUN}" = "true" ]; then
    echo "[dry-run] Would sign image: ${IMAGE_REF}"
  else
    if [ -n "${COSIGN_KEY:-}" ]; then
      echo "Signing image with key: COSIGN_KEY (using env var)"
      cosign sign --key "${COSIGN_KEY}" "${IMAGE_REF}"
    else
      echo "Signing image keylessly (OIDC - requires id-token permissions in CI)"
      cosign sign --yes "${IMAGE_REF}"
    fi
  fi

  # Attach SBOM attestation if present
  if [ -f "${SBOM_PATH}" ]; then
    if [ "${DRY_RUN}" = "true" ]; then
      echo "[dry-run] Would attach SBOM attestation from ${SBOM_PATH} to ${IMAGE_REF}"
    else
      echo "Attaching SBOM attestation (cyclonedx) to ${IMAGE_REF}"
      if [ -n "${COSIGN_KEY:-}" ]; then
        cosign attest --type cyclonedx --predicate "${SBOM_PATH}" --key "${COSIGN_KEY}" "${IMAGE_REF}"
      else
        cosign attest --type cyclonedx --predicate "${SBOM_PATH}" --yes "${IMAGE_REF}"
      fi
    fi
  else
    echo "Warning: SBOM not found at ${SBOM_PATH} — skipping SBOM attestation" >&2
  fi

  # Attach provenance attestation if present
  if [ -f "${PROVENANCE_PATH}" ]; then
    if [ "${DRY_RUN}" = "true" ]; then
      echo "[dry-run] Would attach provenance attestation from ${PROVENANCE_PATH} to ${IMAGE_REF}"
    else
      echo "Attaching provenance attestation to ${IMAGE_REF}"
      if [ -n "${COSIGN_KEY:-}" ]; then
        cosign attest --type slsaprovenance --predicate "${PROVENANCE_PATH}" --key "${COSIGN_KEY}" "${IMAGE_REF}"
      else
        cosign attest --type slsaprovenance --predicate "${PROVENANCE_PATH}" --yes "${IMAGE_REF}"
      fi
    fi
  else
    echo "Warning: provenance not found at ${PROVENANCE_PATH} — skipping provenance attestation" >&2
  fi

  # Verify
  if [ "${DRY_RUN}" = "false" ]; then
    echo "Verifying signature for ${IMAGE_REF}"
    cosign verify "${IMAGE_REF}" || { echo "Signature verification failed for ${IMAGE_REF}"; exit 4; }
    echo "Signature verified for ${IMAGE_REF}"
  fi

else
  # artifact (blob) signing
  ARTIFACT_PATH="${TARGET}"
  if [ ! -f "${ARTIFACT_PATH}" ]; then
    echo "Artifact not found: ${ARTIFACT_PATH}" >&2
    exit 2
  fi

  if [ "${DRY_RUN}" = "true" ]; then
    echo "[dry-run] Would sign artifact blob: ${ARTIFACT_PATH}"
  else
    if [ -n "${COSIGN_KEY:-}" ]; then
      echo "Signing blob with key..."
      cosign sign-blob --key "${COSIGN_KEY}" --output-signature "${ARTIFACT_PATH}.cosign" "${ARTIFACT_PATH}"
    else
      echo "Signing blob keylessly (cosign sign-blob --yes)..."
      cosign sign-blob --yes --output-signature "${ARTIFACT_PATH}.cosign" "${ARTIFACT_PATH}"
    fi
    echo "Signed blob -> ${ARTIFACT_PATH}.cosign"
  fi

  # Attestations for artifact: attach SBOM/provenance as separate attestations using cosign attest-blob
  if [ -f "${SBOM_PATH}" ]; then
    if [ "${DRY_RUN}" = "true" ]; then
      echo "[dry-run] Would attest SBOM for blob"
    else
      if [ -n "${COSIGN_KEY:-}" ]; then
        cosign attest-blob --type cyclonedx --predicate "${SBOM_PATH}" --key "${COSIGN_KEY}" --output-attestation "${ARTIFACT_PATH}.sbom.att" "${ARTIFACT_PATH}"
      else
        cosign attest-blob --type cyclonedx --predicate "${SBOM_PATH}" --yes --output-attestation "${ARTIFACT_PATH}.sbom.att" "${ARTIFACT_PATH}"
      fi
    fi
  fi

  if [ -f "${PROVENANCE_PATH}" ]; then
    if [ "${DRY_RUN}" = "true" ]; then
      echo "[dry-run] Would attest provenance for blob"
    else
      if [ -n "${COSIGN_KEY:-}" ]; then
        cosign attest-blob --type slsaprovenance --predicate "${PROVENANCE_PATH}" --key "${COSIGN_KEY}" --output-attestation "${ARTIFACT_PATH}.prov.att" "${ARTIFACT_PATH}"
      else
        cosign attest-blob --type slsaprovenance --predicate "${PROVENANCE_PATH}" --yes --output-attestation "${ARTIFACT_PATH}.prov.att" "${ARTIFACT_PATH}"
      fi
    fi
  fi

  if [ "${DRY_RUN}" = "false" ]; then
    echo "Verifying blob signature"
    cosign verify-blob --signature "${ARTIFACT_PATH}.cosign" "${ARTIFACT_PATH}" || { echo "Blob signature verification failed"; exit 4; }
    echo "Blob signature verified"
  fi

fi

echo "cosign-sign-artifacts.sh completed successfully"
