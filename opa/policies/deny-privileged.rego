package kubernetes.admission

# Policy: Deny Privileged Containers
# Ensures containers do not run in privileged mode

deny_privileged[msg] {
    input.request.kind.kind == "Pod"
    container := input.request.object.spec.containers[_]
    container.securityContext.privileged == true
    msg := sprintf("Privileged container '%s' is not allowed", [container.name])
}

deny_privileged[msg] {
    input.request.kind.kind == "Pod"
    container := input.request.object.spec.initContainers[_]
    container.securityContext.privileged == true
    msg := sprintf("Privileged init container '%s' is not allowed", [container.name])
}

# Policy: Deny Root Execution
# Ensures containers do not run as root (UID 0)

deny_root_user[msg] {
    input.request.kind.kind == "Pod"
    container := input.request.object.spec.containers[_]
    not container.securityContext.runAsNonRoot
    msg := sprintf("Container '%s' must set runAsNonRoot: true", [container.name])
}

deny_root_user[msg] {
    input.request.kind.kind == "Pod"
    input.request.object.spec.securityContext.runAsUser == 0
    msg := "Pod cannot run as root user (UID 0)"
}

# Policy: Require Cosign Signatures
# Ensures container images are signed with cosign

deny_unsigned_image[msg] {
    input.request.kind.kind == "Pod"
    container := input.request.object.spec.containers[_]
    image := container.image
    
    # Check if image has signature annotation
    not input.request.object.metadata.annotations["cosign.sigstore.dev/signature"]
    
    msg := sprintf("Container '%s' uses unsigned image '%s' - cosign signature required", [container.name, image])
}

# Policy: Block Banned Packages in SBOM
# Prevents deployment of containers with known vulnerable packages

banned_packages := {
    "lodash": ["4.17.0", "4.17.1", "4.17.2", "4.17.3", "4.17.4"],
    "minimist": ["0.0.8", "1.2.0"],
    "axios": ["0.21.0", "0.21.1"]
}

deny_banned_packages[msg] {
    input.request.kind.kind == "Pod"
    sbom := input.request.object.metadata.annotations["sbom.ybuilt.dev/components"]
    component := json.unmarshal(sbom)[_]
    
    banned_versions := banned_packages[component.name]
    component.version == banned_versions[_]
    
    msg := sprintf("Banned package detected: %s@%s (vulnerable version)", [component.name, component.version])
}

# Policy: Require Resource Limits
# Ensures all containers have resource limits set

deny_missing_limits[msg] {
    input.request.kind.kind == "Pod"
    container := input.request.object.spec.containers[_]
    not container.resources.limits.memory
    msg := sprintf("Container '%s' must have memory limit", [container.name])
}

deny_missing_limits[msg] {
    input.request.kind.kind == "Pod"
    container := input.request.object.spec.containers[_]
    not container.resources.limits.cpu
    msg := sprintf("Container '%s' must have CPU limit", [container.name])
}

# Policy: Require Read-Only Root Filesystem
# Enhances security by making root filesystem immutable

deny_writable_root_fs[msg] {
    input.request.kind.kind == "Pod"
    container := input.request.object.spec.containers[_]
    not container.securityContext.readOnlyRootFilesystem == true
    msg := sprintf("Container '%s' must set readOnlyRootFilesystem: true", [container.name])
}

# Policy: Deny Dangerous Capabilities
# Blocks containers from adding dangerous Linux capabilities

dangerous_capabilities := ["SYS_ADMIN", "NET_ADMIN", "SYS_MODULE", "SYS_RAWIO", "SYS_PTRACE", "DAC_READ_SEARCH"]

deny_dangerous_capabilities[msg] {
    input.request.kind.kind == "Pod"
    container := input.request.object.spec.containers[_]
    capability := container.securityContext.capabilities.add[_]
    capability == dangerous_capabilities[_]
    msg := sprintf("Container '%s' cannot add dangerous capability '%s'", [container.name, capability])
}

# Policy: Require Namespace Labels
# Ensures pods are deployed to properly labeled namespaces

deny_unlabeled_namespace[msg] {
    input.request.kind.kind == "Pod"
    namespace := input.request.namespace
    
    # Check if namespace has required labels
    not input.request.object.metadata.namespace.labels["ybuilt.dev/environment"]
    
    msg := sprintf("Namespace '%s' must have 'ybuilt.dev/environment' label", [namespace])
}

# Combined deny rules
deny[msg] {
    msg := deny_privileged[_]
}

deny[msg] {
    msg := deny_root_user[_]
}

deny[msg] {
    msg := deny_unsigned_image[_]
}

deny[msg] {
    msg := deny_banned_packages[_]
}

deny[msg] {
    msg := deny_missing_limits[_]
}

deny[msg] {
    msg := deny_writable_root_fs[_]
}

deny[msg] {
    msg := deny_dangerous_capabilities[_]
}

# Audit-only violations (warnings, not hard failures)
warn[msg] {
    msg := deny_unlabeled_namespace[_]
}
