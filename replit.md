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
- **AI Design Assistant**: Features theme selection, a color palette picker, file upload, and hero/SEO customization.
- **Build Trace Viewer**: Provides structured logging for `GENERATION`, `ASSEMBLY`, `LINT`, and `STATIC-BUILD` stages.
- **Workspace**: A Replit-like environment with a Monaco code editor, file tree navigation, live preview, and a collapsible build trace dock.
- **Job Lifecycle**: Extended states include `created`, `queued`, `generating`, `ready_for_finalization`, `editing`, `building`, `deploying`, and `published`.
- **Scoped Regeneration**: Allows regenerating full-site, hero-only, navigation, footer, or specific blocks.
- **User Authentication**: Mock authentication system with localStorage tokens and social login mockups (Google, Apple, Facebook, Twitter, GitHub).
- **Settings System**: Comprehensive settings with 12 sections, reactive `SettingsContext`, and file persistence, covering appearance, AI/models, and more.
- **Library**: Displays saved drafts with thumbnail generation and a unique black→red→blue diagonal theme.

### System Design Choices
The system is designed to be fully functional in a mock mode without external API keys for Razorpay and AI generation, simulating delays and outcomes. It includes a simple in-memory job queue with a mock worker for processing AI generation requests. The architecture supports user persistence across server restarts and provides immediate visual feedback for appearance setting changes via CSS variable updates.

## External Dependencies
- **React 18 + TypeScript**: Frontend framework.
- **Express.js + TypeScript**: Backend framework.
- **Framer Motion**: For animations.
- **shadcn/ui**: UI component library.
- **TanStack Query**: For data fetching and state management.
- **Tailwind CSS**: For styling.
- **Wouter**: For client-side routing.
- **Razorpay SDK**: For payment gateway integration (India-first focus).