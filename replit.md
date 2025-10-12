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

## External Dependencies
- **React 18 + TypeScript**: Frontend framework.
- **Express.js + TypeScript**: Backend framework.
- **Framer Motion**: For animations.
- **shadcn/ui**: UI component library.
- **TanStack Query**: For data fetching and state management.
- **Tailwind CSS**: For styling.
- **Wouter**: For client-side routing.
- **Razorpay SDK**: For payment gateway integration.