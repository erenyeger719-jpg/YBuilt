# YBUILT - AI Website Builder

## Overview
YBUILT is an AI-powered website builder that generates complete, visually striking websites from user prompts within seconds. It targets the luxury market with a monochrome aesthetic and cinematic glass/gloss effects, aiming to revolutionize website creation through advanced AI generation, a sophisticated user interface, and an India-first payment experience via Razorpay. The platform prioritizes production-enforceable supply chain security and a robust, production-ready backend.

## User Preferences
- Design aesthetic: X.AI × Epic Games (cinematic, tactile, restrained)
- Color palette: Strict monochrome (black → white) with extreme HDR
  - **Exception**: Library page uses black→red→blue diagonal stripes per explicit user request
- Material system: Glass/gloss with specular highlights and reflections
- Payment: India-first with Razorpay (UPI, QR, netbanking, wallets, cards)
- Accessibility: Critical - WCAG AA compliance, keyboard nav, reduced motion support

## System Architecture

### UI/UX Decisions
The design emphasizes a luxurious, monochrome aesthetic with cinematic glass/gloss effects, specular highlights, and reflections. UI elements include a glass-striped hero and metallic text reflections, with support for dark/light modes. Accessibility adheres to WCAG AA compliance, providing keyboard navigation and reduced motion support.

### Technical Implementations
The frontend uses React, TypeScript, and Vite, with `shadcn/ui` for components, Framer Motion for animations, TanStack Query for data fetching, Tailwind CSS for styling, and Wouter for routing. The backend is an Express.js and TypeScript application. Data is stored in-memory using JSON files. Generated websites are stored in `public/previews/{jobId}/index.html`.

### Feature Specifications
- **AI Design Assistant**: Facilitates theme/color selection, file uploads, and SEO customization.
- **Build Trace Viewer**: A 5-stage pipeline visualization (GENERATION → ASSEMBLY → LINT → TEST → BUNDLE) with real-time SSE streaming.
- **Replit-Level Workspace**: An IDE with file management, build prompt panel, Monaco editor, preview/console tabs, and Command Palette.
- **Multi-Stream Console**: Real-time SSE log streaming across various categories with filtering.
- **Agent Autonomy System**: Four levels of autonomy, "Auto-Apply" worker for AI edits, App Testing, and safety/content scanning.
- **Publish Flow**: Manages publishing, including plan/credit checks, Razorpay UPI checkout, invoice generation, and URL provision.
- **Job Lifecycle**: Defines states from `created` to `published` for website generation and deployment.
- **Scoped Regeneration**: Allows regeneration of specific site components (e.g., full-site, hero-only).
- **User Authentication**: JWT-based system with registration, login, and protected routes.
- **Real-time Chat**: Socket.IO integration supporting AI assistant, collaboration, and support modes, with history.
- **Code Execution Engine**: Multi-language support (JS, Python, TS, Bash) with timeout/output limits, disabled by default for security.
- **Project Management**: Role-based collaboration (owner/editor/viewer) with version control and commit history.
- **Settings System**: Production-ready settings for Notifications, Workspace, and Editor with auto-save and Zod validation.
- **Library**: Stores saved drafts with thumbnails.
- **Billing System**: Manages credits, invoices, purchases, and deductions.
- **Theme Scoping Architecture**: Isolates project themes (iframe) from app themes (main UI) using CSS variables.
- **Help Menu System**: Replit-inspired help with live system status and support tickets.
- **Profile Management**: User profile page with avatar, details, projects, roles, and quick links.
- **Account Settings**: Comprehensive account management (Email/Password, Server Location, Notifications, Billing, SSH Keys, Secrets, etc.).
- **Workspace Logo Dropdown**: Enhanced menu with workspace-aware behavior and premium glass styling.
- **E2E Test Coverage**: Comprehensive suite in `test/` for core functionalities.

### System Design Choices
Supports a mock mode for Razorpay and AI generation, simulating delays and outcomes. Includes an in-memory job queue with a mock AI worker. User persistence is ensured, and immediate visual feedback is provided for appearance settings.

### CI-Ready Infrastructure
- **Security Layer:** Multi-layer path validation and atomic write operations (`fsync` + `atomic rename`).
- **Test Infrastructure:** Comprehensive `test/` directory with server lifecycle management, multipart upload helper, unit tests, and Playwright E2E suite with Docker Compose.
- **Observability & Configuration:** `LOG_LEVEL` environment variable, centralized logger, metrics endpoint, production logging with secret redaction, and Prometheus telemetry.
- **CI/Security Hardening:** GitHub Actions CI with Node.js matrix, security scanning (npm audit, Trivy, Snyk), Dependabot, and Docker containerization. Production hardening includes rate limiting, Zod input validation, and centralized error handling.
- **Enterprise Infrastructure:** Advanced CI/CD with parallel jobs, code coverage, semantic-release, OpenTelemetry, Sentry, Grafana/Prometheus, Kubernetes deployment with Helm, rollback infrastructure, and pre-commit hooks.
- **Supply Chain Security:** SBOM generation (CycloneDX), GPG artifact signing, SLSA v0.2 provenance attestation, automated workflows, deterministic builds, and cosign keyless signing.
- **Canary Deployments:** Automated deployment with metric-based promote/rollback using Flagger, synthetic health checks, and traffic splitting.
- **SLO Monitoring:** 5 core SLOs (availability, latency, error rate, job processing, data durability) with Prometheus alerts and Alertmanager integration.
- **Quality Tools:** Flaky test detector and chaos testing harness for resilience.
- **Industrial-Grade Hardening:** Zero-trust OIDC publishing, OPA/Gatekeeper policy enforcement, trace-log correlation, Tempo-Loki-Grafana observability stack, distroless runtime security, SBOM admission webhook, and reproducible dev containers.

## External Dependencies
- **React 18 + TypeScript**: Frontend framework.
- **Express.js + TypeScript**: Backend framework.
- **Framer Motion**: Animations.
- **shadcn/ui**: UI component library.
- **TanStack Query**: Data fetching and state management.
- **Tailwind CSS**: Styling.
- **Wouter**: Client-side routing.
- **Razorpay SDK**: Payment gateway integration.
- **Socket.IO**: Real-time communication for chat.
- **bcrypt**: Password hashing.
- **jsonwebtoken**: JWT token generation and verification.
- **morgan**: HTTP request logging.
- **Zod**: Schema validation.