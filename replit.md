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
- **Build Trace Viewer**: Offers structured logging, transcript downloads, and auto-refresh.
- **Replit-Level Workspace**: A production-ready IDE with a file tree, build prompt panel, Monaco code editor, preview/console tabs, and a Command Palette.
- **Multi-Stream Console**: Provides real-time SSE log streaming across various categories (Agent, System, User, Error) with filtering and search capabilities.
- **Agent Autonomy System**: Features four levels of autonomy, an "Auto-Apply" toggle, an App Testing tool, and safety/content scanning.
- **Publish Flow**: Manages the complete publishing pipeline, including plan/credit checks, Razorpay UPI checkout, invoice generation, and providing a published URL.
- **Job Lifecycle**: Defines states from `created` to `published` to manage website generation and deployment.
- **Scoped Regeneration**: Allows regeneration of specific site components (e.g., full-site, hero-only, navigation, footer).
- **User Authentication**: Mock authentication using localStorage tokens and mockups for social logins.
- **Settings System**: A comprehensive system with file persistence and immediate CSS variable updates for appearance settings.
- **Library**: Stores saved drafts with thumbnails and a unique black→red→blue diagonal theme.
- **Billing System**: Handles credit management, invoice tracking, credit purchases, and deduction upon publishing.
- **Workspace-Only Theme Editor**: A comprehensive per-workspace theme customization system with a modal for color, typography, and preset adjustments. It offers live preview via CSS variables and persistence to `data/workspaces/{jobId}/theme.json`.
- **Help Menu System**: Replit-inspired help interface with hover-based submenu, live system status monitoring, comprehensive support ticket system with file attachments, and dedicated support pages for billing, account, and technical assistance. Features keyboard accessibility and proper focus management.
- **Profile Management**: Comprehensive user profile page with avatar upload (drag-drop, 5MB limit, image preview), auto-save user details (firstName, lastName, bio with 140 char limit, publicProfile toggle), projects list with Open/Export/Delete actions, roles display, and quick links to SSH keys and secrets.
- **Account Settings**: Full-featured account management with 12 sections - Email/Password management, Server Location (US East/West, EU, India, Singapore), Notifications (email, updates, tips), Export Apps, Billing & Plan display, Referrals & Credits (referral code, earnings tracker), Roles & Permissions, SSH Keys CRUD, Account Secrets CRUD, Connected Services (OAuth integrations for GitHub, Google, Figma), Domains CRUD, and Themes selector.
- **Workspace Logo Dropdown**: Enhanced dropdown menu with workspace-aware behavior - shows 13 icons for all items (Home, Activity, Generated Site, Library, Profile, Account, Notifications, Team, Terminal, Appearance, Settings, Help, Logout) using lucide-react, and hides Core/Unread/Back items when in workspace mode for cleaner UX. Features premium glass styling (12px border radius, backdrop-filter blur) when in workspace mode. Implements three-layer protection for logo click behavior: Home page shows no dropdown (focusable no-op), Library page navigates to Home without opening dropdown, workspace pages show normal dropdown. CLUI submenu opens only on click/keyboard (hover disabled). Help submenu uses fixed positioning with z-index 2147483601 to prevent cropping by headers/toolbars.

### System Design Choices
The system supports a mock mode for Razorpay and AI generation, simulating delays and outcomes without requiring external API keys. It includes an in-memory job queue with a mock worker for AI generation requests. User persistence is ensured across server restarts, and immediate visual feedback is provided for appearance setting changes through CSS variable updates.

## External Dependencies
- **React 18 + TypeScript**: Frontend framework.
- **Express.js + TypeScript**: Backend framework.
- **Framer Motion**: For animations.
- **shadcn/ui**: UI component library.
- **TanStack Query**: For data fetching and state management.
- **Tailwind CSS**: For styling.
- **Wouter**: For client-side routing.
- **Razorpay SDK**: For payment gateway integration.