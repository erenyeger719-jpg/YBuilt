# YBUILT - AI Website Builder

## Overview
YBUILT is an AI-powered website builder designed for luxury with a monochrome aesthetic and cinematic glass/gloss effects. Users input a prompt and receive a complete, visually striking website within seconds. The platform aims to provide an India-first payment experience through Razorpay integration and offers comprehensive tools for AI-assisted design, code editing, and deployment. The project's ambition is to revolutionize website creation by combining advanced AI generation with a sophisticated, user-friendly interface.

## User Preferences
- Design aesthetic: X.AI × Epic Games (cinematic, tactile, restrained)
- Color palette: Strict monochrome (black → white) with extreme HDR
  - **Exception**: Library page uses black→red→blue diagonal stripes per explicit user request
- Material system: Glass/gloss with specular highlights and reflections
- Payment: India-first with Razorpay (UPI, QR, netbanking, wallets, cards)
- Accessibility: Critical - WCAG AA compliance, keyboard nav, reduced motion support

## System Architecture

### UI/UX Decisions
The design emphasizes a luxurious, monochrome aesthetic with cinematic glass/gloss effects, specular highlights, and reflections. Key UI elements include a glass-striped hero, metallic text reflections, and shimmer particle effects. Accessibility is a top priority, adhering to WCAG AA compliance, providing keyboard navigation, and supporting reduced motion. The application supports both dark and light modes with low-gloss accessibility and includes a currency toggle for INR/USD.

### Technical Implementations
The frontend is built with React, TypeScript, and Vite, utilizing `shadcn/ui` for components, Framer Motion for animations, TanStack Query for data fetching, Tailwind CSS for styling, and Wouter for routing. The backend is an Express.js and TypeScript application. Data persistence uses in-memory storage with file persistence for jobs, users, and payments, saving to JSON files (`data/jobs.json`, `data/users.json`, `data/payments.log`). Generated websites are stored in `public/previews/{jobId}/index.html`.

### Feature Specifications
- **AI Design Assistant**: Theme selection, color palette picker, file upload (25MB limit), and hero/SEO customization with Apply changes workflow.
- **Build Trace Viewer**: Structured logging with expandable stages (`GENERATION`, `ASSEMBLY`, `LINT`, `STATIC-BUILD`), download transcript, 3s auto-refresh.
- **Replit-Level Workspace**: Production-ready IDE with:
  - **Header**: Clickable Ybuilt logo (→ home), log summary pill, Publish button with credit indicator
  - **Left Panel**: File tree with New/Upload/Rename/Delete, Build Prompt panel with autonomy controls, Agent Tools (collapsible)
  - **Center**: Monaco code editor with tabs, split view, syntax highlighting, file save
  - **Right Panel**: Preview tab (Mobile/Tablet/Desktop device selector) + Console tab (multi-stream logs with filtering)
  - **Command Palette (⌘K)**: Global searchable interface with 6 sections (Files, Actions, Tools, Developer, Integrations, User), keyboard shortcuts
- **Multi-Stream Console**: Real-time SSE log streaming with 4 tabs (Agent, System, User, Error), filter by source/level, search, Clear/Download/Tail controls, auto-scroll.
- **Agent Autonomy System**: 4 levels (Pause All, Confirm Major, Confirm Actions, Full Autonomy), Run Agent button, Auto-Apply toggle, App Testing tool, Safety/Content scan.
- **Publish Flow**: Complete pipeline with plan/credit check, Razorpay UPI checkout (mock mode ready), credit deduction, invoice generation, published URL with copy/open actions.
- **Job Lifecycle**: Extended states: `created` → `queued` → `generating` → `ready_for_finalization` → `editing` → `building` → `deploying` → `published`.
- **Scoped Regeneration**: Full-site, hero-only, navigation, footer, or specific blocks with autonomy-aware execution.
- **User Authentication**: Mock auth with localStorage tokens, social login mockups (Google, Apple, Facebook, Twitter, GitHub).
- **Settings System**: 12 sections with reactive `SettingsContext`, file persistence, immediate CSS variable updates (appearance, AI/models, workspace, organization).
- **Library**: Saved drafts with thumbnails, unique black→red→blue diagonal theme, workspace navigation.
- **Billing System**: Credit management with `data/billing.json` invoice tracking, credit purchase via Razorpay, deduction on publish.

### System Design Choices
The system is designed to be fully functional in a mock mode without external API keys for Razorpay and AI generation, simulating delays and outcomes. It includes a simple in-memory job queue with a mock worker for processing AI generation requests. The architecture supports user persistence across server restarts and provides immediate visual feedback for appearance setting changes via CSS variable updates.

### Recent Bug Fixes (October 2025)
- **Select & Open Workspace Flow (Fixed)**: Resolved race condition and JSON parsing bug where clicking "Select & Open Workspace" on Finalize page showed "Workspace not ready" error. Fix includes: (1) POST /api/jobs/:jobId/select now returns `workspaceReady: true` field, (2) Finalize.tsx properly parses JSON response with `res.json()`, (3) Query refetch disabled during navigation with `enabled: !!jobId && !selectMutation.isPending` to prevent status change from blocking navigation.

## External Dependencies
- **React 18 + TypeScript**: Frontend framework.
- **Express.js + TypeScript**: Backend framework.
- **Framer Motion**: For animations.
- **shadcn/ui**: UI component library.
- **TanStack Query**: For data fetching and state management.
- **Tailwind CSS**: For styling.
- **Wouter**: For client-side routing.
- **Razorpay SDK**: For payment gateway integration (India-first focus).