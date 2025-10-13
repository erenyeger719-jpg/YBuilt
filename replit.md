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

## System Architecture

### UI/UX Decisions
The design emphasizes a luxurious, monochrome aesthetic featuring cinematic glass/gloss effects, specular highlights, and reflections. Key UI elements include a glass-striped hero, metallic text reflections, shimmer particle effects, and support for dark/light modes. Accessibility is a core focus, adhering to WCAG AA compliance, providing keyboard navigation, and supporting reduced motion.

### Technical Implementations
The frontend is built with React, TypeScript, and Vite, utilizing `shadcn/ui` for components, Framer Motion for animations, TanStack Query for data fetching, Tailwind CSS for styling, and Wouter for routing. The backend is an Express.js and TypeScript application. Data is stored in-memory using JSON files for persistence (`data/jobs.json`, `data/users.json`, `data/payments.log`, `data/users/{userId}/profile.json`, `data/users/{userId}/ssh-keys.json`, `data/users/{userId}/secrets.json`, `data/users/{userId}/integrations.json`, `data/users/{userId}/domains.json`). Generated websites are stored in `public/previews/{jobId}/index.html`. The backend provides 24 dedicated endpoints for profile and account management with comprehensive CRUD operations.

### Feature Specifications
- **AI Design Assistant**: Facilitates theme selection, color palette picking, file uploads, hero/SEO customization, and an "Apply changes" workflow.
- **Build Trace Viewer**: Production-ready 5-stage pipeline visualization (GENERATION → ASSEMBLY → LINT → TEST → BUNDLE) with SSE streaming from `/api/jobs/:jobId/build-trace/stream`, accordion UI for expandable stage details, transcript download, artifact tracking, and real-time status indicators (success/error/in-progress).
- **Replit-Level Workspace**: A production-ready IDE with complete file management (create/read/update/delete/upload via 6 secure endpoints), build prompt panel, Monaco code editor, preview/console tabs, and a Command Palette. Includes file upload UI in FileToolbar with drag-drop, 25MB limit, automatic cache invalidation, and toast notifications.
- **Multi-Stream Console**: Provides real-time SSE log streaming across various categories (Agent, System, User, Error) with filtering and search capabilities.
- **Agent Autonomy System**: Features four levels of autonomy, an "Auto-Apply" worker (activates when `autoApplyEdits === "auto-medium-plus"` AND `autonomy >= "high"`), App Testing tool, and safety/content scanning. Auto-Apply automatically applies AI file edits via workspace API with retry logic, exponential backoff, and comprehensive build trace integration.
- **Publish Flow**: Manages the complete publishing pipeline, including plan/credit checks, Razorpay UPI checkout, invoice generation, and providing a published URL.
- **Job Lifecycle**: Defines states from `created` to `published` to manage website generation and deployment.
- **Scoped Regeneration**: Allows regeneration of specific site components (e.g., full-site, hero-only, navigation, footer).
- **User Authentication**: Mock authentication using localStorage tokens and mockups for social logins.
- **Settings System**: Production-ready settings with three comprehensive sections - Notifications (30+ fields for channels, events, digest, quiet hours, webhooks with test button), Workspace (22+ fields for runtime config, agent autonomy, build pipeline, preview options, integrations), and Editor (28 fields for core editor, code assist, AI integration). Features auto-save with optimistic updates, Zod validation, toast notifications, and file persistence to `data/settings/{userId}.json`. Appearance settings provide immediate CSS variable updates. Schema includes validated legacy fields (template, language, autosave, previewResolution, lintOnSave) with duplicate fields removed (keybindings→keymap, lineWrap→wordWrap, editorTheme→theme) to prevent data loss.
- **Library**: Stores saved drafts with thumbnails and a unique black→red→blue diagonal theme.
- **Billing System**: Handles credit management, invoice tracking, credit purchases, and deduction upon publishing.
- **Theme Scoping Architecture**: Complete isolation between project themes (ThemeModal applies to iframe preview only, persists to `data/workspaces/{jobId}/theme.json`) and app themes (SettingsContext applies to main workspace UI only, persists to `data/settings/{userId}.json`). Uses iframe boundary for isolation with documentElement targeting, HSL color conversion, and CSS variable scoping - no cross-contamination.
- **Help Menu System**: Replit-inspired help interface with hover-based submenu, live system status monitoring, comprehensive support ticket system with file attachments, and dedicated support pages for billing, account, and technical assistance. Features keyboard accessibility and proper focus management.
- **Profile Management**: Comprehensive user profile page with avatar upload (drag-drop, 5MB limit, image preview), auto-save user details (firstName, lastName, bio with 140 char limit, publicProfile toggle), projects list with Open/Export/Delete actions, roles display, and quick links to SSH keys and secrets.
- **Account Settings**: Full-featured account management with 12 sections - Email/Password management, Server Location (US East/West, EU, India, Singapore), Notifications (email, updates, tips), Export Apps, Billing & Plan display, Referrals & Credits (referral code, earnings tracker), Roles & Permissions, SSH Keys CRUD, Account Secrets CRUD, Connected Services (OAuth integrations for GitHub, Google, Figma), Domains CRUD, and Themes selector.
- **Workspace Logo Dropdown**: Enhanced dropdown menu with workspace-aware behavior - shows 13 icons for all items (Home, Activity, Generated Site, Library, Profile, Account, Notifications, Team, Terminal, Appearance, Settings, Help, Logout) using lucide-react, and hides Core/Unread/Back items when in workspace OR settings mode for cleaner UX. Features premium glass styling (12px border radius, backdrop-filter blur) when in workspace OR settings mode. Implements three-layer protection for logo click behavior: Home page shows no dropdown (focusable no-op), Library page navigates to Home without opening dropdown, workspace/settings pages show normal dropdown with premium styling. CLUI submenu opens only on click/keyboard (hover disabled). Help submenu uses fixed positioning with z-index 2147483601 to prevent cropping by headers/toolbars.
- **E2E Test Coverage**: Comprehensive test suite in `test/` directory with `generate.test.js` (6 tests for job creation, status transitions, build trace) and `workflow.test.js` (10 tests for workspace CRUD, file upload, SSE streaming). Total 16 E2E tests using Node.js native fetch, assert module, with proper error handling and CI/CD integration.

### System Design Choices
The system supports a mock mode for Razorpay and AI generation, simulating delays and outcomes without requiring external API keys. It includes an in-memory job queue with a mock worker for AI generation requests. User persistence is ensured across server restarts, and immediate visual feedback is provided for appearance setting changes through CSS variable updates.

### CI-Ready Infrastructure (Production)
**Security Layer:**
- Multi-layer path validation in `server/utils/paths.ts` and `server/utils/paths.js` (single-decode, backslash/percent rejection, segment validation including 3+ consecutive dots, containment checks)
- All 5 workspace file endpoints protected with `validateAndResolvePath()` returning proper 400/403 status codes
- Protection against path traversal, Windows-style attacks, suspicious dot patterns (e.g., ....//....//etc/passwd), and URL encoding bypasses
- Enhanced segment validation rejects `.`, `..`, and segments matching `/^\.{3,}$/` (3+ consecutive dots)

**Atomic Operations:**
- `server/utils/atomicWrite.js` provides fsync + atomic rename pattern for zero partial writes
- All 18 file persistence operations use atomic writes (jobs, drafts, profiles, settings, workspace files)
- File descriptor cleanup in finally block prevents resource leaks

**Test Infrastructure:**
- `test/harness.cjs` - Server lifecycle management (start/wait/stop with npx tsx)
- `test/run-all-tests.cjs` - Orchestrator that manages server and runs test suite sequentially
- `test/upload-helper.cjs` - Multipart upload helper using axios + form-data (fixes "Unexpected end of form" errors)
- All tests converted to .cjs with TEST_PORT environment variable support
- Unit tests: `test/unit-path-validation.test.cjs` (4/4 passing), `test/unit-atomic-write.test.cjs` (3/3 passing)
- Comprehensive test documentation in `test/README.md`

**Observability & Configuration:**
- LOG_LEVEL environment variable (DEBUG|INFO|WARN|ERROR) with level-aware logger
- All console.* calls replaced with centralized logger (server/routes.ts, server/storage.ts)
- Razorpay mode validation: RAZORPAY_MODE (mock|test|live) with required key checks in live mode
- Metrics endpoint: GET /api/metrics (job stats, queue depth, auto-apply tracking)
- Periodic metrics logging every 60 seconds

**UI Polish & Bug Fixes:**
- CSS variable `--modal-z: 99999` for normalized z-index across all modals
- Removed legacy z-index values (2147483601) for consistent layering
- All modals use centralized z-index management
- Fixed React Hooks violation in Workspace component (moved useMutation hooks before early returns to ensure consistent hook call order)

**Setup Requirements:**
- See `PACKAGE_JSON_CHANGES.md` for required package.json scripts (test/qa) and tsx dependency
- See `test/README.md` for complete test infrastructure documentation
- Environment variables: TEST_PORT (default 5001), LOG_LEVEL (default INFO), RAZORPAY_MODE (default mock)

## External Dependencies
- **React 18 + TypeScript**: Frontend framework.
- **Express.js + TypeScript**: Backend framework.
- **Framer Motion**: For animations.
- **shadcn/ui**: UI component library.
- **TanStack Query**: For data fetching and state management.
- **Tailwind CSS**: For styling.
- **Wouter**: For client-side routing.
- **Razorpay SDK**: For payment gateway integration.