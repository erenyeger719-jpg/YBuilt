# YBUILT - AI Website Builder

## Project Overview
Luxurious monochrome AI website builder with cinematic glass/gloss aesthetics. Users enter a prompt and receive a complete website in 2-4 seconds. Features India-first payment integration with Razorpay.

## Current State (MVP Complete + Library)
- ✅ Stunning glass-striped hero with diagonal backdrop
- ✅ One-prompt AI generation with mock worker
- ✅ Job queue system with real-time polling
- ✅ Razorpay payment integration (mock mode)
- ✅ 8 demo preview templates with thumbnails and hover overlay
- ✅ Dark/light modes with low-gloss accessibility
- ✅ Currency toggle (INR/USD)
- ✅ Full accessibility (ARIA, keyboard nav, 4.5:1 contrast, prefers-reduced-motion)
- ✅ Profile icon with accessible dropdown menu
- ✅ Library page with black→red→blue diagonal stripes
- ✅ Library button in header navigation

## Recent Changes
- **2025-01-11**: Added Library page with black→red→blue diagonal slash stripes (intentional color departure from monochrome per user request)
- **2025-01-11**: Added ProfileIcon component with accessible dropdown menu using shadcn primitives
- **2025-01-11**: Added preview thumbnails for all 8 showcase cards with hover play button overlay
- **2025-01-11**: Added Library button to header navigation
- **2025-01-11**: Fixed webhook HMAC verification to use raw body before JSON parsing (express.raw middleware)
- **2025-01-11**: Removed all emoji from UI to comply with design guidelines
- **2025-01-11**: Updated theme toggle logic to use explicit add/remove instead of toggle for better reliability
- **2025-01-11**: Added diagonal striped glass backdrop to hero section with metallic text reflections
- **2025-01-11**: Implemented complete AI generation flow with job queue and status polling
- **2025-01-11**: Added Razorpay payment integration with webhook handling
- **2025-01-11**: Created currency toggle and low-gloss accessibility mode

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
  - `ProfileIcon.tsx` - Circular profile button with accessible dropdown menu
  
- **Pages**:
  - `Studio.tsx` - Homepage with hero and showcase
  - `Library.tsx` - User library with black→red→blue diagonal stripes, project grid, empty state
  
- **Hooks**:
  - `useGeneration.ts` - Job creation, polling, status management
  
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
  
- **Storage** (`server/storage.ts`):
  - In-memory storage with file persistence
  - Job management (create, get, update status)
  - User credit tracking
  
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
- LSP warning about PromptInput import in Hero.tsx (TypeScript cache issue, app works correctly)
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
