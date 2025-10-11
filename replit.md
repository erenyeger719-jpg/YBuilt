# YBUILT - AI Website Builder

## Project Overview
Luxurious monochrome AI website builder with cinematic glass/gloss aesthetics. Users enter a prompt and receive a complete website in 2-4 seconds. Features India-first payment integration with Razorpay.

## Current State (MVP Complete + Auth + Library + Settings)
- ✅ Stunning glass-striped hero with diagonal backdrop
- ✅ One-prompt AI generation with mock worker
- ✅ Job queue system with real-time polling
- ✅ Razorpay payment integration (mock mode)
- ✅ 8 demo preview templates with thumbnails and hover overlay
- ✅ Dark/light modes with low-gloss accessibility
- ✅ Currency toggle (INR/USD)
- ✅ Full accessibility (ARIA, keyboard nav, 4.5:1 contrast, prefers-reduced-motion)
- ✅ Mock authentication system with localStorage tokens
- ✅ Profile icon with user initials and accessible dropdown menu
- ✅ Library page with forced black→red→blue diagonal theme
- ✅ Library button in header navigation
- ✅ User persistence across server restarts
- ✅ Settings system with black→purple→sky blue diagonal gradient theme
- ✅ 12 settings sections with reactive SettingsContext and file persistence
- ✅ Appearance settings form with 9 functional controls (theme, glass, gloss, parallax, motion, fonts, power modes)
- ✅ Immediate visual feedback via CSS variable updates on all appearance changes

## Recent Changes
- **2025-01-11**: Implemented complete Appearance settings form with 9 functional controls
- **2025-01-11**: Added theme selector (system/dark/light/force-library) with immediate effect
- **2025-01-11**: Implemented glass intensity (0-100%), parallax intensity (0-100%), font size (12-20px) sliders
- **2025-01-11**: Added gloss finish, low power mode, low bandwidth mode toggle switches
- **2025-01-11**: Created font family selector (Inter/Valmeria/Poppins) and motion selector (full/reduced/none)
- **2025-01-11**: All appearance changes apply immediately via SettingsContext CSS variable updates
- **2025-01-11**: E2E tested: Settings navigation, slider interactions, toggle persistence, theme changes
- **2025-01-11**: Expanded settings schema to 12 comprehensive sections with workspace and organization
- **2025-01-11**: Created SettingsContext providing reactive state management and localStorage caching
- **2025-01-11**: Implemented PATCH /api/settings/:section with validation for all 12 sections
- **2025-01-11**: Added storage layer with getSettings/updateSettings methods and file persistence to data/settings/{userId}.json
- **2025-01-11**: Created Settings page with sidebar navigation and section routing
- **2025-01-11**: Updated ProfileIcon with "Settings" and "Manage Billing" menu items
- **2025-01-11**: Settings persist across sessions with localStorage and server file storage
- **2025-01-11**: Simplified Library.tsx to use CSS-based diagonal gradient (removed individual band divs)
- **2025-01-11**: Updated index.css with .library-root::before for glass matcap overlay
- **2025-01-11**: Fixed Library theme CSS variables to use exact high-contrast values
- **2025-01-11**: Added OAuth social login buttons to SignInModal (Google, Apple, Facebook, Twitter, GitHub)
- **2025-01-11**: Implemented mock OAuth endpoints: GET /api/auth/:provider and /api/auth/mock-success
- **2025-01-11**: OAuth buttons auto-create users with format demo-{provider}@ybuilt.com
- **2025-01-11**: All OAuth providers work in mock mode without external API configuration
- **2025-01-11**: Implemented complete mock auth system with localStorage JWT-like tokens
- **2025-01-11**: Added user persistence with loadUsers() and saveUsers() methods
- **2025-01-11**: Auto-create users on sign-in if they don't exist (mock mode convenience)
- **2025-01-11**: Created SignInModal component with email/password fields and keyboard accessibility
- **2025-01-11**: Updated ProfileIcon to display user initials (Avatar) when authenticated
- **2025-01-11**: Redesigned Library page with forced theme system using black→red→light blue diagonal bands
- **2025-01-11**: Added "Respect system theme" toggle for Library page with accessibility support
- **2025-01-11**: Fixed critical persistence bug: users and credits now load from data/users.json on server startup
- **2025-01-11**: Added POST /api/auth/signin, POST /api/auth/signup, GET /api/me endpoints
- **2025-01-11**: Fixed Header.tsx nested <a> warning by restructuring Button with asChild
- **2025-01-11**: Updated README with comprehensive auth and Library theme documentation
- **2025-01-11**: Added Library page with black→red→blue diagonal slash stripes
- **2025-01-11**: Added ProfileIcon component with accessible dropdown menu using shadcn primitives
- **2025-01-11**: Added preview thumbnails for all 8 showcase cards with hover play button overlay
- **2025-01-11**: Fixed webhook HMAC verification to use raw body before JSON parsing
- **2025-01-11**: Removed all emoji from UI to comply with design guidelines

## User Preferences
- Design aesthetic: X.AI × Epic Games (cinematic, tactile, restrained)
- Color palette: Strict monochrome (black → white) with extreme HDR
  - **Exception**: Library page uses black→red→blue diagonal stripes per explicit user request
- Material system: Glass/gloss with specular highlights and reflections
- Payment: India-first with Razorpay (UPI, QR, netbanking, wallets, cards)
- Accessibility: Critical - WCAG AA compliance, keyboard nav, reduced motion support

## Architecture

### Frontend (React + TypeScript + Vite)
- **Components**:
  - `Hero.tsx` - Main hero with glass-striped backdrop and prompt input
  - `Header.tsx` - Fixed header with logo, Library button, payment, currency, theme toggles, profile icon
  - `PromptInput.tsx` - AI generation trigger with loading states
  - `Showcase.tsx` - 8 preview cards with modal display and thumbnails
  - `PreviewCard.tsx` - Individual preview card with hover play overlay
  - `PreviewModal.tsx` - Full-screen iframe for generated sites
  - `PaymentButton.tsx` - Razorpay checkout integration
  - `CurrencyToggle.tsx` - INR/USD switching
  - `ProfileIcon.tsx` - Circular profile button with user initials and accessible dropdown menu
  - `SignInModal.tsx` - Auth modal with email/password fields and mode toggle
  
- **Pages**:
  - `Studio.tsx` - Homepage with hero and showcase
  - `Library.tsx` - User library with forced black→red→blue diagonal theme, project grid, empty state, theme toggle
  
- **Hooks**:
  - `useGeneration.ts` - Job creation, polling, status management
  
- **Services**:
  - `mockAuth.ts` - Client-side auth service with localStorage token management
  
- **Styling**:
  - Custom glass/gloss utilities in `index.css`
  - Diagonal striped backdrop system
  - Metallic text reflections
  - Shimmer particle effects

### Backend (Express + TypeScript)
- **Routes**:
  - `POST /api/generate` - Create AI generation job
  - `GET /api/jobs/:jobId` - Poll job status
  - `GET /api/razorpay_key` - Get payment key (mock mode aware)
  - `POST /webhooks/razorpay` - Payment webhook with HMAC verification
  - `GET /api/credits/:userId` - Fetch user credits
  - `POST /api/auth/signin` - Sign in (auto-creates user in mock mode)
  - `POST /api/auth/signup` - Create new account
  - `GET /api/me` - Get current user metadata
  
- **Storage** (`server/storage.ts`):
  - In-memory storage with file persistence
  - Job management (create, get, update status)
  - User management (create, get by email, get by ID)
  - User credit tracking
  - Loads users and jobs from JSON on startup
  - Persists changes back to disk
  
- **Queue** (`server/queue.ts`):
  - Simple in-memory job queue
  - Mock worker with 2-4s delay
  - Keyword-based template selection
  - HTML generation and file writing

### Data Persistence
- `data/jobs.json` - Job queue storage
- `data/users.json` - User credits (demo user starts with 0)
- `data/payments.log` - Payment audit trail
- `public/previews/{jobId}/index.html` - Generated websites

### Mock Mode
- Fully functional without API keys
- Razorpay simulated (1.5s delay)
- AI generation simulated (2-4s delay)
- 8 template variations based on keywords

## Key Dependencies
- React 18 + TypeScript
- Express.js + TypeScript
- Framer Motion (animations)
- shadcn/ui (components)
- TanStack Query (data fetching)
- Tailwind CSS (styling)
- Wouter (routing)
- Razorpay SDK (payments)

## Environment Variables
All optional - app runs in mock mode without them:
- `RAZORPAY_KEY_ID` - Razorpay test key
- `RAZORPAY_KEY_SECRET` - Razorpay secret
- `RAZORPAY_WEBHOOK_SECRET` - Webhook signature verification
- `OPENAI_API_KEY` - For future real AI (commented)
- `REDIS_URL` - For production queue (commented)

## Future Enhancements
1. Real OpenAI/Gemini integration for AI generation
2. Redis + BullMQ for production job queue
3. PostgreSQL for persistent storage (schema already defined)
4. User authentication with project history
5. Multi-page website generation
6. Export to GitHub/Zip
7. Custom branding extraction
8. Responsive preview modes
9. Cashfree/PayU secondary gateways
10. Subscription plans

## Development Notes
- Always maintain glass/gloss aesthetic consistency
- Ensure all interactions have prefers-reduced-motion fallbacks
- Keep accessibility as top priority (ARIA, keyboard, contrast)
- Test both mock mode and real integrations
- Maintain strict monochrome palette (no UI colors)

## Testing Strategy
1. **Generation Flow**: Prompt → Job → Poll → Display
2. **Payment Flow**: Click → Checkout → Webhook → Credits
3. **Accessibility**: Keyboard nav, screen reader, reduced motion
4. **Responsiveness**: Mobile to 4K displays
5. **Dark/Light Modes**: All components adapt correctly

## Known Issues
- Console contains validateDOMNesting accessibility warnings (non-blocking, cosmetic)
- Razorpay script loads on every mount (could be optimized)
- Preview iframe occasionally shows 404 immediately after generation (timing issue with mock worker file writing)
- Toast notifications are ephemeral and difficult to assert in automated tests

## Run Instructions
```bash
npm install
npm run dev
# App available at http://localhost:5000
```

## Replit Deployment
1. Import repo
2. Click "Run"
3. Auto-deploys to `.replit.app` domain
4. Add secrets in Secrets panel for production mode
5. Webhooks auto-configured
