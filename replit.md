# YBUILT - AI Website Builder

## Overview
YBUILT is an AI-powered website builder designed for luxury, offering a monochrome aesthetic and cinematic glass/gloss effects. It generates complete, visually striking websites from user prompts within seconds. The platform aims to provide an India-first payment experience via Razorpay and includes comprehensive tools for AI-assisted design, code editing, and deployment. The project's ambition is to revolutionize website creation through advanced AI generation and a sophisticated, user-friendly interface.

## User Preferences
- Design aesthetic: X.AI × Epic Games (cinematic, tactile, restrained)
- Color palette: Strict monochrome (black → white) with extreme HDR
  - **Exception**: Library page uses black→red→blue diagonal stripes per explicit user request
- Material system: Glass/gloss with specular highlights and reflections
- Payment: India-first with Razorpay (UPI, QR, netbanking, wallets, cards)
- Accessibility: Critical - WCAG AA compliance, keyboard nav, reduced motion support

## System Architecture

### UI/UX Decisions
The design prioritizes a luxurious, monochrome aesthetic with cinematic glass/gloss effects, specular highlights, and reflections. Key UI elements include a glass-striped hero, metallic text reflections, and shimmer particle effects. Accessibility is paramount, adhering to WCAG AA compliance, providing keyboard navigation, and supporting reduced motion. The application supports dark/light modes with low-gloss accessibility and includes an INR/USD currency toggle.

### Technical Implementations
The frontend uses React, TypeScript, and Vite, with `shadcn/ui` for components, Framer Motion for animations, TanStack Query for data fetching, Tailwind CSS for styling, and Wouter for routing. The backend is an Express.js and TypeScript application. Data is stored in-memory with file persistence for jobs, users, and payments in JSON files (`data/jobs.json`, `data/users.json`, `data/payments.log`). Generated websites are stored in `public/previews/{jobId}/index.html`.

### Feature Specifications
- **AI Design Assistant**: Features theme selection, color palette picker, file upload (25MB limit), hero/SEO customization, and an "Apply changes" workflow.
- **Build Trace Viewer**: Provides structured logging with expandable stages, a transcript download, and 3-second auto-refresh.
- **Replit-Level Workspace**: A production-ready IDE with a header (Ybuilt logo, log summary, Publish button), left panel (file tree, Build Prompt panel, Agent Tools), center (Monaco code editor with tabs/split view), right panel (Preview/Console tabs), and a Command Palette (⌘K).
- **Multi-Stream Console**: Real-time SSE log streaming across Agent, System, User, and Error tabs, with filtering, search, clear, download, and auto-scroll functionalities.
- **Agent Autonomy System**: Offers 4 levels of autonomy (Pause All to Full Autonomy), a "Run Agent" button, an "Auto-Apply" toggle, an App Testing tool, and safety/content scanning.
- **Publish Flow**: Manages the complete publishing pipeline, including plan/credit checks, Razorpay UPI checkout (mockable), credit deduction, invoice generation, and providing a published URL.
- **Job Lifecycle**: Defines states from `created` to `published` to manage the website generation and deployment process.
- **Scoped Regeneration**: Allows regeneration of specific parts of a site (e.g., full-site, hero-only, navigation, footer, specific blocks) with autonomy-aware execution.
- **User Authentication**: Mock authentication using localStorage tokens and mockups for social logins.
- **Settings System**: A comprehensive system with 12 sections, reactive `SettingsContext`, file persistence, and immediate CSS variable updates for appearance settings.
- **Library**: Stores saved drafts with thumbnails and a unique black→red→blue diagonal theme, allowing workspace navigation.
- **Billing System**: Handles credit management, invoice tracking, credit purchases via Razorpay, and credit deduction upon publishing.

### System Design Choices
The system is designed with a mock mode for Razorpay and AI generation, simulating delays and outcomes without external API keys. It includes an in-memory job queue with a mock worker for AI generation requests. The architecture ensures user persistence across server restarts and provides immediate visual feedback for appearance setting changes via CSS variable updates.

### Recent Changes (October 2025)
- **Left Toolbar Buttons - Complete Functionality (Completed Oct 12)**: Implemented full functionality for three toolbar buttons in left pane header:
  - **Save File Button**: Downloads currently selected file with correct MIME type detection (18+ file types including images, documents, code files), preserves filename and extension, shows toast notifications
  - **New Chat Button**: Opens modal with 6 quick action presets (Check bugs, Add payment, Connect AI, Add SMS, Add database, Add auth), populates PromptBar with selected preset
  - **New Folder Button**: Opens dialog to create folder in workspace via API, refreshes file tree after creation
  - **Header Settings**: z-index 60 (up from 40), role="toolbar", aria-label="Workspace left controls", overflow-visible for dropdown menus
  - **MIME Type Support**: html, css, js, json, xml, txt, md, ts, tsx, jsx, png, jpg, jpeg, gif, svg, webp, ico, pdf, zip, with fallback to application/octet-stream
  - **Acceptance Tests Passed**: All 29 test steps verified - buttons visible at all widths, responsive overflow menu, correct functionality, no regressions

- **Workspace UI Fix - Left Toolbar & PromptBar Layout (Completed Oct 12)**: Fixed toolbar visibility and restructured prompt area with vertical layout:
  - **Left Pane Header Fix**: Added `overflow-visible` to sticky header, changed ResizableSplitter left pane to `overflow-x-hidden` to allow dropdown menus while preventing horizontal scroll
  - **FileToolbar Visibility**: Buttons (New Chat, Save, New Folder) always visible at all pane widths - inline when wide, overflow menu when narrow (≤26%)
  - **PromptBar Vertical Layout**: Removed collapse/expand feature, restructured to 3-row layout:
    - **Row A (Pills)**: Horizontal scroll, max-height 48px, displays uploaded files as badges
    - **Row B (Textarea)**: Prominent and roomy, min-h-48px max-h-140px, bg-black/35 rounded-lg with padding
    - **Row C (Controls)**: Upload, Agent, Build buttons with justify-end alignment
  - **Functionality Preserved**: All existing features work (file upload 25MB limit, Enter/Shift+Enter submission, agent settings, new chat presets, folder creation)
  - **Acceptance Tests Passed**: Playwright test verified 28 steps - toolbar visibility at all widths, vertical layout, pills scrolling, controls accessible, modals functional

- **Publish Button Moved to Preview Toolbar (Completed Oct 12)**: Relocated Publish button to Preview toolbar, before fullscreen button; shifted Build-status badge:
  - **DOM Placement**: Publish now in Preview toolbar, immediately BEFORE "Open in new tab" (fullscreen) button
  - **Preview Toolbar Order**: Device mode buttons → Separator → Refresh → **Publish** → Open in new tab → Page Tool
  - **Build-status Badge Shift**: Moved 35px LEFT using Tailwind `-translate-x-[35px]`, mobile reduced to 18px (`max-[720px]:-translate-x-[18px]`)
  - **Top Layer**: z-index 9999, `pointer-events: auto`, `overflow-visible` on toolbar container
  - **Conditional Display**: Publish ONLY visible when Preview tab active, hidden when Console tab active
  - **Responsive**: Desktop shows icon + text, mobile (<720px) icon-only, Build-status reduces shift on mobile
  - **Accessibility**: aria-label="Publish", role="button", tabIndex="0", keyboard activation (Enter/Space)
  - **Acceptance Tests Passed**: DOM order verified, Publish before fullscreen, Build-status shifted 35px left, no clipping, keyboard accessible

- **Responsive Workspace UI Fix (Completed Oct 12)**: Fixed left pane clipping and squeezing issues when resizing:
  - **ResizableSplitter**: Changed width clamp from 20-50% to 18-50%, added real-time compact mode detection at 26% threshold using `currentLeftPercent` state for immediate UI updates during drag
  - **FileToolbar Compact Mode**: Added overflow menu system - shows all buttons inline when width > 26%, collapses to New Chat + overflow menu (three dots) when <= 26%
  - **PromptBar Layout**: Fixed textarea minimum width (120px), stable button sizes, proper flex spacing to prevent squeezing
  - **Sticky Header Fix**: Removed nested ScrollArea from FileTree to prevent sticky header issues
  - **Acceptance Tests Passed**: Verified no control cropping at 18-50% width range, compact mode triggers correctly, overflow menu accessible

## External Dependencies
- **React 18 + TypeScript**: Frontend framework.
- **Express.js + TypeScript**: Backend framework.
- **Framer Motion**: For animations.
- **shadcn/ui**: UI component library.
- **TanStack Query**: For data fetching and state management.
- **Tailwind CSS**: For styling.
- **Wouter**: For client-side routing.
- **Razorpay SDK**: For payment gateway integration.