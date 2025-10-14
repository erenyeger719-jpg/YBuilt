# YBUILT - AI Website Builder

## Overview
YBUILT is an AI-powered website builder designed to generate complete, visually striking websites from user prompts within seconds. It targets the luxury market with a monochrome aesthetic and cinematic glass/gloss effects. The platform aims to revolutionize website creation through advanced AI generation, a sophisticated user interface, and an India-first payment experience via Razorpay.

## User Preferences
- Design aesthetic: X.AI × Epic Games (cinematic, tactile, restrained)
- Color palette: Strict monochrome (black → white) with extreme HDR
  - **Exception**: Library page uses black→red→blue diagonal stripes per explicit user request
- Material system: Glass/gloss with specular highlights and reflections
- Payment: India-first with Razorpay (UPI, QR, netbanking, wallets, cards)
- Accessibility: Critical - WCAG AA compliance, keyboard nav, reduced motion support

## Enforcement Phase (October 14, 2025)
**Production-Enforceable Supply Chain Security**

### Enforcement Infrastructure
- **Policy-Check Workflow**: Hard enforcement (exit 1) on unsigned images, no `continue-on-error`
- **Deterministic Builds**: Uses stable git commit timestamp (`SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)`)
- **Gatekeeper Constraint**: Requires `cosign.sigstore.dev/signature` annotations on deployments
- **Sigstore Policy Controller**: Complete installation guide for admission-time verification
- **Prometheus Canary Alerts**: Auto-rollback triggers with Kubernetes secret mounts (not GitHub Actions placeholders)
- **Vulnerability Pipeline**: Trivy filesystem scan + npm audit + OPA policy tests

### Files Created (Enforcement Phase)
- `k8s/gatekeeper/constraint-verify-cosign.yaml` - Gatekeeper constraint + Sigstore guide
- `.github/workflows/policy-check.yml` - CI hard enforcement workflow
- `monitoring/prometheus-canary-alerts.yaml` - Canary alerts with K8s secrets
- `IMPLEMENTATION_ENFORCE.md` - Complete enforcement report
- `PR_BODY_ENFORCE.md` - Ready-to-paste PR description

### Critical Fixes
1. **Hard Enforcement**: Removed `continue-on-error` from policy-check, now fails with exit 1 on unsigned
2. **Deterministic Builds**: Fixed SOURCE_DATE_EPOCH to use commit timestamp instead of current time
3. **K8s Secrets**: Changed Alertmanager from GitHub Actions placeholders to proper Kubernetes secret mounts

### Enforcement Status
- ✅ CI blocks unsigned images (hard fail)
- ✅ Reproducible builds are deterministic
- ✅ Gatekeeper blocks unsigned deployments
- ✅ Canary auto-rollback operational
- ✅ Complete vulnerability scanning
- 📋 Sigstore Policy Controller ready to deploy
- 📋 Alertmanager secrets need configuration

## MEGA PROMPT Platform 10x Hardening (October 14, 2025)
**Production-Ready Dual-Mode Signing + Comprehensive Verification**

### Core Files Hardened (3)
1. **scripts/reproducible-build.sh**
   - Fixed SOURCE_DATE_EPOCH to use git commit timestamp (fully deterministic)
   - Improved packaging logic: dist/ → build/ → src/ fallback
   - Fixed critical bug: corrected fallback path to prevent src/src nesting and missing metadata
   - Added deterministic tar flags: --sort=name, --mtime, --owner/--group

2. **scripts/cosign-sign-artifacts.sh**
   - Added dual-mode support: `--image` (containers) and `--artifact` (tarballs/releases)
   - Keyless OIDC signing preferred, key-based fallback (zero key management in CI)
   - Comprehensive SBOM (CycloneDX) and provenance (SLSA) attestation for both modes
   - Built-in verification with error handling

3. **.github/workflows/publish.yml**
   - Added `permissions.id-token: write` for OIDC keyless signing
   - Installed cosign via sigstore/cosign-installer@v3 (pinned v2.11.0)
   - Comprehensive verification: reproducible build → SBOM → provenance → sign → verify
   - Dry-run mode support for testing without actual signing/pushing

### Key Improvements
- **Deterministic Builds**: Same git commit → identical artifact hash (supply chain verification)
- **Dual-Mode Signing**: Supports both container images and build artifacts (tarballs, releases)
- **Keyless OIDC**: Zero key management using GitHub OIDC tokens (secure by default)
- **Full Attestation**: SBOM + SLSA provenance attached to all signatures
- **Admission Control**: Gatekeeper + Sigstore Policy Controller block unsigned deployments

### Implementation Files
- `IMPLEMENTATION_PLATFORM10X.md` - Complete implementation report with diffs, verification, manual steps
- `PR_BODY_PLATFORM10X.md` - PR description with acceptance checklist, testing guide, deployment steps

### Critical Fix During Review
- **Issue**: Fallback packaging in reproducible-build.sh was broken (src/src nesting, missing metadata)
- **Fix**: Removed pre-created directory, added proper destinations to copy commands
- **Verification**: ✅ PASS from architect - tarball structure now correct

### Status
- ✅ All 3 core files hardened and executable
- ✅ All Platform 10x infrastructure verified present
- ✅ DevContainer has all tools (cosign v2.2.0, OPA, Trivy, Helm, kubectl)
- ✅ Comprehensive documentation created
- ✅ Critical bug fixed and verified by architect
- 📋 Ready for PR (git commands in IMPLEMENTATION_PLATFORM10X.md)

## System Architecture

### UI/UX Decisions
The design emphasizes a luxurious, monochrome aesthetic featuring cinematic glass/gloss effects, specular highlights, and reflections. Key UI elements include a glass-striped hero, metallic text reflections, shimmer particle effects, and support for dark/light modes. Accessibility is a core focus, adhering to WCAG AA compliance, providing keyboard navigation, and supporting reduced motion.

### Technical Implementations
The frontend is built with React, TypeScript, and Vite, utilizing `shadcn/ui` for components, Framer Motion for animations, TanStack Query for data fetching, Tailwind CSS for styling, and Wouter for routing. The backend is an Express.js and TypeScript application. Data is stored in-memory using JSON files. Generated websites are stored in `public/previews/{jobId}/index.html`.

### Feature Specifications
- **AI Design Assistant**: Facilitates theme selection, color palette picking, file uploads, hero/SEO customization, and an "Apply changes" workflow.
- **Build Trace Viewer**: Production-ready 5-stage pipeline visualization (GENERATION → ASSEMBLY → LINT → TEST → BUNDLE) with SSE streaming, real-time status indicators, and artifact tracking.
- **Replit-Level Workspace**: A production-ready IDE with complete file management, build prompt panel, Monaco code editor, preview/console tabs, and a Command Palette, including drag-drop file uploads.
- **Multi-Stream Console**: Provides real-time SSE log streaming across various categories (Agent, System, User, Error) with filtering and search capabilities.
- **Agent Autonomy System**: Features four levels of autonomy, an "Auto-Apply" worker for AI file edits, App Testing tool, and safety/content scanning.
- **Publish Flow**: Manages the complete publishing pipeline, including plan/credit checks, Razorpay UPI checkout, invoice generation, and providing a published URL.
- **Job Lifecycle**: Defines states from `created` to `published` to manage website generation and deployment.
- **Scoped Regeneration**: Allows regeneration of specific site components (e.g., full-site, hero-only, navigation, footer).
- **User Authentication**: Mock authentication using localStorage tokens.
- **Settings System**: Production-ready settings for Notifications, Workspace, and Editor, featuring auto-save with optimistic updates, Zod validation, and file persistence. Appearance settings provide immediate CSS variable updates.
- **Library**: Stores saved drafts with thumbnails and a unique black→red→blue diagonal theme.
- **Billing System**: Handles credit management, invoice tracking, credit purchases, and deduction upon publishing.
- **Theme Scoping Architecture**: Complete isolation between project themes (iframe preview) and app themes (main workspace UI) using an iframe boundary and CSS variable scoping.
- **Help Menu System**: Replit-inspired help interface with hover-based submenu, live system status monitoring, and a support ticket system.
- **Profile Management**: Comprehensive user profile page with avatar upload, auto-save user details, projects list, roles display, and quick links to SSH keys and secrets.
- **Account Settings**: Full-featured account management with sections for Email/Password, Server Location, Notifications, Export Apps, Billing & Plan, Referrals & Credits, Roles & Permissions, SSH Keys CRUD, Account Secrets CRUD, Connected Services, Domains CRUD, and Themes selector.
- **Workspace Logo Dropdown**: Enhanced dropdown menu with workspace-aware behavior and premium glass styling.
- **E2E Test Coverage**: Comprehensive test suite in `test/` directory for job creation, status transitions, build trace, workspace CRUD, file upload, and SSE streaming.

### System Design Choices
The system supports a mock mode for Razorpay and AI generation, simulating delays and outcomes. It includes an in-memory job queue with a mock worker for AI generation requests. User persistence is ensured across server restarts, and immediate visual feedback is provided for appearance setting changes through CSS variable updates.

### CI-Ready Infrastructure (Production)
- **Security Layer:** Multi-layer path validation protects against path traversal, Windows-style attacks, suspicious dot patterns, and URL encoding bypasses.
- **Atomic Operations:** `server/utils/atomicWrite.js` provides fsync + atomic rename pattern for zero partial writes, used across all file persistence operations.
- **Test Infrastructure:** Comprehensive `test/` directory with a harness for server lifecycle management and multipart upload helper. Includes unit tests for path validation and atomic writes. Playwright E2E test suite in `test/e2e/` with Docker Compose orchestration for cross-browser smoke tests.
- **Observability & Configuration:** `LOG_LEVEL` environment variable, centralized logger, Razorpay mode validation, and a metrics endpoint (`GET /api/metrics`) for job stats and queue depth.
- **CI/Security Hardening:** Production logging with secret redaction, Prometheus telemetry, enhanced path security with symlink protection, atomic write durability with parent directory fsync, GitHub Actions CI with Node.js matrix, security scanning (npm audit, Trivy, Snyk), Dependabot, and Docker containerization.
- **Enterprise Infrastructure:** Advanced CI/CD with parallel jobs, code coverage enforcement, release automation (semantic-release), OpenTelemetry tracing, Sentry integration, a comprehensive monitoring stack (Grafana/Prometheus), enhanced QA (mutation testing, fuzzing), Kubernetes deployment support with Helm charts, rollback infrastructure, and pre-commit hooks.
- **Supply Chain Security:** SBOM generation (CycloneDX), GPG artifact signing with verification, SLSA v0.2 provenance attestation, automated workflows in `.github/workflows/supplychain.yml`. Complete verification guide in `docs/supply-chain.md`.
- **Canary Deployments:** Automated deployment with metric-based promote/rollback in `.github/workflows/canary-promote.yml`. Synthetic health checks, traffic splitting (10-100%), Helm canary templates in `k8s/helm/templates/canary-config.yaml`.
- **SLO Monitoring:** 5 core SLOs (availability 99.9%, latency p95 < 300ms, error rate < 0.5%, job processing, data durability). 11 Prometheus alerts in `prometheus/alerts.yaml`. Alertmanager config with Slack/PagerDuty in `.monitoring/alerting/alertmanager.yml`.
- **Quality Tools:** Flaky test detector (`tools/flaky-detector.js`) with retry logic and reporting. Chaos testing harness (`tools/chaos/simple-kill.js`) for resilience testing. Security gates with Trivy image scanning and npm audit enforcement in CI.
- **Industrial-Grade Hardening:** Zero-trust OIDC publishing (`.github/workflows/publish.yml`), reproducible deterministic builds (`scripts/reproducible-build.sh`), cosign keyless signing (`scripts/cosign-publish.sh`), SLSA in-toto provenance (`scripts/provenance/attest-oci.js`), OPA/Gatekeeper policy enforcement (`opa/policies/deny-privileged.rego`), Flagger progressive delivery (`helm/values-canary.yaml`), trace-log correlation (`tools/log-trace-correlation.js`), Tempo-Loki-Grafana observability stack (`monitoring/tempo-loki-stack.md`), distroless runtime security (`docs/distroless-migration.md`), SBOM admission webhook (`k8s/admission/sbom-verify-admission.yaml`), devcontainer reproducible dev environment (`.devcontainer/`), daily automated audit workflows (`.github/workflows/audit.yml`). Complete implementation report in `IMPLEMENTATION_INDUSTRIAL.md`. 3 critical security fixes documented (signature verification bypass, cert-manager issuer, cosign script mismatch).

## External Dependencies
- **React 18 + TypeScript**: Frontend framework.
- **Express.js + TypeScript**: Backend framework.
- **Framer Motion**: For animations.
- **shadcn/ui**: UI component library.
- **TanStack Query**: For data fetching and state management.
- **Tailwind CSS**: For styling.
- **Wouter**: For client-side routing.
- **Razorpay SDK**: For payment gateway integration.