# ybuilt - AI Website Builder

> **Build smarter. Launch faster.** Transform your ideas into digital reality with one prompt.

A luxurious, ultra-HDR monochrome AI website builder featuring cinematic glass/gloss aesthetics, one-prompt website generation, and India-first payment integration.

![ybuilt Hero](https://img.shields.io/badge/Status-MVP_Complete-success)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%2B%20Express%20%2B%20TypeScript-blue)

## ✨ Features

### 🎨 Cinematic Design System
- **Ultra-HDR Monochrome** - Strict black-to-white palette with extreme dynamic range
- **Glass & Gloss Materials** - Layered glass surfaces with specular highlights and reflections
- **Diagonal Striped Backdrop** - 30° tilted glass stripes with metallic text reflections
- **Studio Lighting** - Soft bloom effects, rim highlights, and micro-reflections
- **Dark/Light Modes** - Seamless theme switching with persistent preferences
- **Low-Gloss Mode** - High-contrast accessibility option

### 🚀 AI Generation Engine
- **One-Prompt Creation** - Describe your website, get complete HTML in seconds
- **Mock Worker** - 2-4s simulated generation without API keys
- **Real-time Polling** - Live job status updates
- **8 Demo Templates** - Portfolio, SaaS, E-commerce, Blog, Agency, Dashboard, Restaurant, Event
- **Smart HTML Generation** - Keyword-based template selection and customization

### 💳 India-First Payments
- **Razorpay Integration** - UPI, QR codes, netbanking, wallets, cards
- **Mock Mode** - Full functionality without payment keys
- **Currency Toggle** - INR/USD display (UPI flows INR only)
- **Webhook Verification** - HMAC SHA256 signature validation
- **Credit System** - Automatic credit allocation (1 credit per ₹799)

### ♿ Accessibility
- **ARIA Labels** - Complete semantic structure
- **Keyboard Navigation** - All modals and interactions accessible
- **4.5:1 Contrast** - WCAG AA compliant text
- **Reduced Motion** - Full prefers-reduced-motion support
- **Focus Management** - Clear focus indicators

## 🛠️ Tech Stack

### Frontend
- **React 18** + **TypeScript** - Type-safe component architecture
- **Vite** - Lightning-fast HMR and builds
- **Tailwind CSS** - Utility-first styling with custom glass system
- **Framer Motion** - Cinematic animations
- **shadcn/ui** - Accessible component primitives
- **TanStack Query** - Server state management
- **Wouter** - Lightweight routing

### Backend
- **Express.js** - REST API server
- **TypeScript** - End-to-end type safety
- **In-Memory Queue** - Mock job processing
- **File System** - Job persistence in JSON
- **Crypto** - HMAC webhook verification

### Future-Ready
- OpenAI/Gemini integration (commented examples included)
- Redis + BullMQ for production queue
- PostgreSQL schema already defined

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The app will be available at **http://localhost:5000**

### Mock Mode (Default)

YBUILT runs in **MOCK_MODE** by default - no API keys required! All features work with simulated data:

- ✅ **AI Generation** - 2-4s mock builds with realistic templates
- ✅ **Payments** - Razorpay returns `rzp_test_mock_key_12345`
- ✅ **Authentication** - Any email/password works
- ✅ **Credits** - Demo user starts with 100 credits
- ✅ **Workspace** - Full IDE with Monaco editor and console logs
- ✅ **Publishing** - Credit deduction and invoice generation

**To toggle MOCK_MODE:**
```typescript
// In server config (auto-detected, no changes needed)
const MOCK_MODE = !process.env.RAZORPAY_KEY_ID || 
                  !process.env.OPENAI_API_KEY;
```

### Environment Variables (Production)

Create a `.env` file to enable real integrations:

```bash
# Razorpay (enables real payments)
RAZORPAY_KEY_ID=rzp_live_your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# OpenAI (enables real AI generation)
OPENAI_API_KEY=sk-your-key-here

# Redis (for production job queue)
REDIS_URL=redis://localhost:6379
```

**Key Swapping:**
- Add `.env` file with real keys → Automatically exits MOCK_MODE
- Remove `.env` → Returns to MOCK_MODE
- Mix & match: Real Razorpay + Mock AI, or vice versa

## 📁 Project Structure

```
ybuilt/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Route pages
│   │   └── lib/           # Utilities
│   └── index.html
├── server/                # Express backend
│   ├── routes.ts          # API endpoints
│   ├── storage.ts         # Data layer
│   └── queue.ts           # Job processing
├── shared/                # Shared types
│   └── schema.ts          # Drizzle schemas
├── public/                # Static assets
│   └── previews/          # Generated websites
├── data/                  # Persistence
│   ├── jobs.json          # Job queue
│   ├── users.json         # User credits
│   └── payments.log       # Payment audit
└── README.md
```

## 🎯 How It Works

### 1. User Input
User enters a website description in the glass-framed prompt input.

### 2. Job Creation
```typescript
POST /api/generate { "prompt": "modern portfolio website" }
→ Returns { "jobId": "uuid", "status": "pending" }
```

### 3. Mock Worker Processing
- Analyzes prompt keywords (portfolio, blog, ecommerce, etc.)
- Selects appropriate template
- Generates custom HTML with tailored content
- Writes to `public/previews/{jobId}/index.html`

### 4. Status Polling
```typescript
GET /api/jobs/{jobId}
→ Returns { "status": "completed", "result": "/previews/{jobId}/index.html" }
```

### 5. Preview Modal
Generated website displays in full-screen iframe modal with glass aesthetics.

## 💰 Payment Configuration

### Razorpay Modes
YBUILT supports three payment modes via the `RAZORPAY_MODE` environment variable:

#### Mock Mode (Default)
```bash
# No environment variable needed - runs in mock mode by default
npm run dev
```
- Simulated payments
- No API keys required
- Full UPI/payment UI without real charges
- Credits added instantly

#### Test Mode
```bash
# Create .env file
RAZORPAY_MODE=test
RAZORPAY_KEY_ID=rzp_test_your_key_here
RAZORPAY_KEY_SECRET=your_test_secret_here
RAZORPAY_WEBHOOK_SECRET=your_test_webhook_secret_here
```
- Uses Razorpay test environment
- Real payment flow but no actual charges
- Test cards: 4111 1111 1111 1111

#### Live Mode (Production)
```bash
# Production .env file
RAZORPAY_MODE=live
RAZORPAY_KEY_ID=rzp_live_your_key_here
RAZORPAY_KEY_SECRET=your_live_secret_here
RAZORPAY_WEBHOOK_SECRET=your_live_webhook_secret_here
```
- Real payments and charges
- Production Razorpay credentials required
- Webhook signature verification enabled

### QA Testing - Simulate Webhook

In mock mode, use the simulate endpoint to test payment flows:

```bash
curl -X POST http://localhost:5000/api/payments/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo",
    "amount": 799,
    "orderId": "test_order_123"
  }'
```

Response:
```json
{
  "success": true,
  "credits": 1,
  "paymentId": "pay_mock_1234567890",
  "message": "Payment simulated successfully"
}
```

## 💰 Payment Flow

### Mock Mode (Default)
1. User clicks "Buy Creator Plan ₹799"
2. Mock payment processes in 1.5s
3. Success toast shows credits added
4. No real payment required

### Production Mode
1. Razorpay checkout modal opens
2. User completes payment (UPI/Card/etc)
3. Webhook receives `payment.captured` event
4. HMAC signature verified
5. Credits added to user account
6. Transaction logged to `data/payments.log`

## 🔐 Authentication (Mock Mode)

### Mock Auth System
YBUILT includes a fully functional mock authentication system that works without requiring OAuth providers or backend authentication services.

### How to Sign In (Mock Mode)
1. Click the **Profile Icon** in the top-right corner
2. Select **"Sign In"** from the dropdown
3. Enter any email and password (any combination works in mock mode)
4. Click **"Sign In"** or **"Create Account"**
5. Your session is stored locally and persists across page refreshes

### Testing Credentials
```bash
# Any email/password combination works in mock mode
Email: demo@ybuilt.com
Password: demo123

# Or create your own
Email: yourname@example.com
Password: anything
```

### Mock Auth Features
- **LocalStorage Token** - JWT-like token stored in `ybuilt_session` key
- **User Persistence** - Demo user created in `data/users.json`
- **GET /api/me** - Returns current user metadata
- **Profile Display** - Shows user initials in avatar when signed in
- **Instant Sign Out** - Clears session with one click
- **OAuth Social Login** - Google, Apple, Facebook, Twitter/X, GitHub (all work in mock mode)

### OAuth Sign-In (Mock Mode)
The sign-in modal includes social login buttons that work seamlessly without external API keys:

**Supported Providers:**
- Google
- Apple
- Facebook  
- Twitter/X
- GitHub

**How It Works:**
1. Click any OAuth button (e.g., "Sign in with Google")
2. In mock mode, creates user with email: `demo-{provider}@ybuilt.com`
3. Automatically signs you in and displays provider name in profile
4. User persists to `data/users.json` just like email/password accounts

**Testing OAuth:**
```bash
# All providers work without configuration
1. Click "Sign in with Google" → Creates demo-google@ybuilt.com
2. Click "Sign in with Apple" → Creates demo-apple@ybuilt.com
3. Each provider creates a unique mock user
```

**Mock Endpoints:**
- `GET /api/auth/:provider` - Initiates OAuth flow (redirects to mock-success in MOCK_MODE)
- `GET /api/auth/mock-success` - Creates demo user and completes sign-in

### Switching to Real OAuth
To replace mock auth with real authentication (Google, GitHub, etc.):

1. **Install Passport.js** (example code commented in `server/routes.ts`)
2. **Add OAuth Strategy** - Google, GitHub, or email/password
3. **Update** `client/src/lib/mockAuth.ts` to use real endpoints
4. **Configure** environment variables for OAuth credentials
5. **Remove** mock mode checks

## 💻 Replit-Level Workspace

### Production-Ready IDE
YBUILT includes a complete, Replit-style workspace with Monaco editor, multi-stream console, and agent autonomy system.

**Access Workspace:**
1. Generate a website from home page
2. Click **"Select"** on finalized job
3. Click **"Open Workspace"** to enter IDE

### Workspace Features

**🎯 Header Controls**
- **Clickable Logo** - Returns to home with tooltip
- **Log Summary Pill** - Shows build status: success/error/building
- **Publish Button** - Deploy with credit indicator

**📁 Left Panel**
- **File Tree** - Navigate project files with full CRUD operations
  - **New File/Folder** - Create files and directories
  - **Upload Files** - Drag & drop or button upload (25MB limit)
  - **Rename/Delete** - Context menu for file management
  - **Supported Formats** - Images, documents, code files (jpg, png, pdf, txt, js, css, html, etc.)
- **Build Prompt Panel** - View original prompt, add refinements
- **Agent Tools** - Autonomy controls and agent settings

**✏️ Center Panel - Monaco Editor**
- Syntax highlighting for HTML/CSS/JS
- Multiple file tabs
- Split view support
- Auto-save on Ctrl+S

**👁️ Right Panel - Preview & Console**
- **Preview Tab:**
  - Live iframe preview
  - Device selector: Mobile (375px) / Tablet (768px) / Desktop (1024px)
  - Refresh, Open in new tab, Screenshot controls
  
- **Console Tab:**
  - Multi-stream logs: Agent, System, User, Error
  - Real-time SSE streaming from `data/jobs/{jobId}/logs.jsonl`
  - Filter by source: `[express]`, `[worker]`, `[agent]`, `[browser]`
  - Filter by level: info, warn, error
  - Search across all logs
  - Controls: Clear, Download Transcript, Tail (live/paused)
  - Auto-scroll when tailing

### 🔍 Build Trace Viewer

A comprehensive 5-stage pipeline visualization system that streams build progress in real-time.

**Pipeline Stages:**
```
GENERATION → ASSEMBLY → LINT → TEST → BUNDLE
```

**Key Features:**
- **Real-time SSE Streaming** - Live updates via `/api/jobs/:jobId/build-trace/stream`
- **Accordion UI** - Expandable stage details with log entries
- **Status Indicators:**
  - 🔄 Running - Animated spinner
  - ✅ Success - Green checkmark
  - ❌ Failed - Red X mark
  - ⏱️ Pending - Clock icon
- **Stage Progress Bar** - Visual pipeline with chevron separators
- **Transcript Download** - Export complete build log
- **Auto-scroll Toggle** - Control scroll behavior for live logs
- **Artifact Tracking** - Files generated per stage with metadata

**API Endpoints:**
```typescript
// Get build trace
GET /api/jobs/:jobId/build-trace
→ Returns { stages: {...}, currentStage: "LINT", completedAt: "..." }

// Stream live updates (SSE)
GET /api/jobs/:jobId/build-trace/stream
→ Server-Sent Events with real-time stage updates

// Download transcript
GET /api/jobs/:jobId/build-trace/download
→ Returns text file with complete build log
```

**Stage Data Structure:**
```typescript
interface BuildStageTrace {
  status: "pending" | "running" | "success" | "failed";
  startedAt?: string;
  completedAt?: string;
  logs: Array<{
    timestamp: string;
    level: "info" | "warn" | "error";
    message: string;
    details?: any;
  }>;
  artifacts: string[];  // Generated files
}
```

**Integration with Console:**
- Build trace viewer appears in dedicated tab
- Stages auto-expand on errors
- Logs sync with workspace console
- Download includes full trace and console logs

**⌨️ Command Palette (⌘K)**
- Global keyboard shortcut: Cmd+K / Ctrl+K
- Searchable command interface
- 6 sections with 30+ commands:
  - **Files** - New, Upload, Search
  - **Actions** - Preview, Console, Stop, Refresh
  - **Tools** - VS Code, SSH, Settings, Publishing
  - **Developer** - Database, Secrets, Shell, Workflows
  - **Integrations** - Auth, Git, Storage, VNC
  - **User** - My Apps, Remix, Settings, Sign Out

### Agent Autonomy System

**4 Autonomy Levels:**
1. **Pause All** - Manual approval for every change
2. **Confirm Major** - Approval for major changes only
3. **Confirm Actions** - Approval per action
4. **Full Autonomy** - Auto-apply all changes

**Agent Controls:**
- **Run Agent** button - Triggers build with selected autonomy level
- **Auto-Apply** toggle - Enable autonomous edits
- **App Testing** - Integrated testing tool
- **Safety/Content Scan** - Security verification
- **Compute Tier** - Display selected compute level
- **Model Selection** - AI model indicator

**Build Process:**
```typescript
// Trigger agent build
POST /api/jobs/:jobId/build
{
  "autonomy": "medium",  // low, medium, high, max
  "prompt": "Add dark mode toggle"
}
→ Returns { "success": true, "status": "queued" }
```

### 🤖 Auto-Apply System

The Auto-Apply worker automatically executes AI-suggested file operations when autonomy conditions are met.

**Activation Conditions:**
```typescript
// Auto-apply enabled when BOTH conditions true:
1. autoApplyEdits === "auto-medium-plus"  // Workspace setting
2. autonomy >= "high"                      // Build autonomy level
```

**File Operations:**
```typescript
// Supported operations from AI responses
interface FileOperation {
  type: "create" | "update" | "delete";
  path: string;
  content?: string;  // For create/update
}

// Auto-applied via workspace API
POST /api/workspace/:jobId/files
PATCH /api/workspace/:jobId/files/:path
DELETE /api/workspace/:jobId/files/:path
```

**Retry Logic:**
- **Exponential Backoff** - 1s → 2s → 4s → 8s delays
- **Max Attempts** - 3 retries per operation
- **Error Recovery** - Graceful fallback to manual mode
- **Build Trace Logging** - All operations logged to ASSEMBLY stage

**Settings Configuration:**
```typescript
// In Settings → Workspace
{
  "autoApplyEdits": "auto-medium-plus",  // Options: "review", "auto-medium-plus", "always"
  "agentAutonomyDefault": "high",        // Default autonomy level
  "autoSaveDelay": 500                   // Debounce for auto-save
}
```

**Build Trace Integration:**
```typescript
// Auto-apply logs appear in ASSEMBLY stage
{
  "stage": "ASSEMBLY",
  "logs": [
    { "message": "Auto-applying 3 file operations...", "level": "info" },
    { "message": "✓ Created: components/DarkModeToggle.tsx", "level": "info" },
    { "message": "✓ Updated: App.tsx (added import)", "level": "info" },
    { "message": "⚠ Retry 1/3: Failed to update styles.css", "level": "warn" },
    { "message": "✓ Updated: styles.css (retry succeeded)", "level": "info" }
  ]
}
```

**Error Handling:**
- File conflicts → Backup original, apply change, log warning
- Network errors → Retry with backoff, fallback to manual
- Permission errors → Skip operation, notify user via toast
- Invalid paths → Sanitize and retry, or fail gracefully

**Cache Invalidation:**
- Automatic cache bust on file changes
- File tree refresh after batch operations
- Editor reloads affected files
- Preview iframe auto-refreshes

### Publishing from Workspace

**Complete Publish Flow:**
1. Click **Publish** button in workspace header
2. System checks credit balance via `GET /api/plan`
3. **If insufficient credits:**
   - Razorpay UPI checkout modal opens
   - User completes payment (₹50 for publish)
   - Credits auto-added via `POST /api/verify_payment`
4. **If sufficient credits:**
   - Direct publish via `POST /api/jobs/:jobId/publish`
   - ₹50 deducted from balance
   - Invoice created in `data/billing.json`
   - Published URL returned
5. Success modal shows URL with Copy/Open actions

**Billing System:**
- Invoice types: `publish`, `credit_purchase`
- Tracks: paymentId, orderId, credits, amount
- Stored in: `data/billing.json`
- Demo user starts with 100 credits

### Workspace Error Handling

**Defensive Programming:**
- ✅ Safe array access with optional chaining
- ✅ Graceful error recovery UI when data missing
- ✅ Retry/View Logs/Back Home buttons on errors
- ✅ Loading states for all async operations
- ✅ No crashes on undefined/null workspace data

**Error Recovery UI:**
```
┌─────────────────────────────────────┐
│  Workspace Error                     │
│  Failed to load workspace data       │
│                                      │
│  [Retry] [View Logs] [Back to Home] │
└─────────────────────────────────────┘
```

### Seed Logs for Testing

Demo workspace logs available at `data/jobs/demo-job-123/logs.jsonl`:

```json
{"ts":"2024-10-11T18:16:13.000Z","level":"info","source":"[express]","msg":"serving on port 5000","meta":{}}
{"ts":"2024-10-11T18:19:05.000Z","level":"info","source":"[agent]","msg":"Starting generation","meta":{"stage":"GENERATION"}}
{"ts":"2024-10-11T18:19:18.000Z","level":"info","source":"[agent]","msg":"Generated HTML structure","meta":{"stage":"ASSEMBLY"}}
{"ts":"2024-10-11T18:19:22.000Z","level":"warn","source":"[worker]","msg":"Linting detected minor issues","meta":{"stage":"LINT","issues":2}}
{"ts":"2024-10-11T18:19:28.000Z","level":"info","source":"[worker]","msg":"Build complete","meta":{"stage":"STATIC-BUILD","success":true}}
```

**Console displays:**
- Timestamp formatting
- Source badges with colors
- Log level indicators
- Expandable metadata/details
- JSON syntax highlighting

## 📚 Library Page & Theme Forcing

### Library Theme System
The Library page uses a **forced theme** that overrides the global light/dark mode to maintain visual consistency with its unique design.

### Visual Design
The Library page features:
- **Black → Red → Light Blue** diagonal slash bands (30° angle)
- **High-Contrast Glass** materials with specular highlights
- **Forced Color Scheme** that remains visible regardless of site theme
- **Accessibility-First** design with ≥4.5:1 contrast ratios

### Theme Behavior
```javascript
// Library page automatically sets forced theme
document.body.dataset.forceTheme = 'library';

// CSS tokens override global theme
body[data-force-theme="library"] .library-root {
  --lib-bg-right: #000000;      // Deep black
  --lib-bg-center: #E01010;     // High-contrast red
  --lib-bg-left-gradient-start: #CFF2FF;  // Light cyan
  --lib-bg-left-gradient-end: #9BD6FF;    // Light sky blue
}
```

### Respecting System Theme (Optional)
Users can toggle **"Respect system theme"** inside the Library page to:
- Disable the forced theme
- Allow Library to adapt to light/dark mode
- Restore global color tokens

This gives users control while maintaining the default cinematic experience.

### Light Mode Resilience
The Library page's forced theme ensures visual consistency regardless of system preferences:
- **Toggle site to light mode** → Library remains black/red/blue
- **CSS scoping** via `body[data-force-theme="library"]` overrides global theme
- **Glass matcap overlay** maintains cinematic aesthetic in all modes
- **High contrast** white text on dark bands, preserved in all conditions

### Implementation Details
1. **Force Theme** - `useEffect` sets `data-force-theme="library"` on mount
2. **CSS Scope** - `.library-theme` tokens override global variables
3. **Cleanup** - Effect cleanup removes forced theme on unmount
4. **Toggle** - Switch component controls `respectSystemTheme` state
5. **Fallback** - Glass materials work without `backdrop-filter` support

## 🎨 Theme Scoping Architecture

YBUILT implements **complete theme isolation** between project previews and the main workspace UI.

### Project Themes vs App Themes

**Two Independent Theme Systems:**
1. **Project Themes (ThemeModal)** - Apply to iframe preview only
2. **App Themes (Settings → Appearance)** - Apply to workspace UI only

### 🖼️ Project Themes (Preview Only)

Accessible via the "Theme for project" button in workspace header.

**Features:**
- **Iframe-Scoped** - Changes apply to preview content only
- **Per-Workspace Persistence** - Saved to `data/workspaces/{jobId}/theme.json`
- **Live Preview** - See changes in real-time via CSS variables
- **Color Customization:**
  - Background, foreground, primary, accent
  - Card, popover, border colors
  - Destructive (error) states
  - Chart color palette (5 colors)
- **Typography:**
  - Font families: Sans, Serif, Mono
  - Font size control
- **Border Radius** - Global radius control
- **Preset Themes:**
  - Light (default)
  - Dark
  - High Contrast
- **Reset to Defaults** - One-click restore

**API Endpoints:**
```typescript
// Get project theme
GET /api/workspace/:jobId/theme
→ Returns { meta: {...}, colors: {...}, fonts: {...} }

// Save project theme
POST /api/workspace/:jobId/theme
{
  "colors": { "background": "#ffffff", ... },
  "fonts": { "sans": "Inter", ... },
  "borderRadius": "0.5rem"
}
→ Returns updated theme
```

**Data Structure:**
```typescript
interface ProjectTheme {
  meta: {
    name: string;
    createdAt: string;
    author: string;
  };
  colors: {
    background: string;
    text: string;
    primaryBackground: string;
    primaryText: string;
    // ... 20+ color tokens
  };
  fonts: {
    sans: string;
    serif: string;
    mono: string;
  };
  borderRadius: string;
  customColors?: Array<{ name: string; value: string }>;
}
```

**File Storage:**
```
data/workspaces/{jobId}/theme.json
```

### 🎛️ App Themes (Workspace UI Only)

Accessible via Settings → Appearance.

**Features:**
- **Global Scope** - Apply to main workspace, not previews
- **User Persistence** - Saved to `data/settings/{userId}.json`
- **Appearance Controls:**
  - Theme: System / Light / Dark
  - Glass intensity (0-100%)
  - Gloss finish toggle
  - Parallax intensity (0-100%)
  - Motion: Full / Reduced / None
  - Low bandwidth mode
  - Font family
  - Font size (12-20px)

**Settings API:**
```typescript
// Get user settings
GET /api/settings
→ Returns { appearance: {...}, workspace: {...}, ... }

// Update appearance
PATCH /api/settings/appearance
{
  "theme": "dark",
  "glassIntensity": 75,
  "fontSize": 14
}
→ Returns updated settings
```

**Applied via CSS Variables:**
```css
/* App-level only (not iframe) */
document.documentElement.style.setProperty("--glass-alpha", "0.75");
document.documentElement.style.setProperty("--base-font-size", "14px");
```

### 🔒 Isolation Architecture

**How Themes Stay Separate:**

1. **iframe Boundary** - Natural DOM isolation
   ```typescript
   // Project theme targets iframe document
   const iframeDoc = iframe.contentWindow.document.documentElement;
   iframeDoc.style.setProperty("--background", projectColor);
   
   // App theme targets root document
   document.documentElement.style.setProperty("--glass-alpha", appSetting);
   ```

2. **No Cross-Contamination** - Different CSS variable scopes
   - Project: `--background`, `--foreground`, `--primary`, etc.
   - App: `--glass-alpha`, `--parallax-intensity`, `--base-font-size`

3. **No postMessage Required** - Direct DOM access via `contentWindow`
   ```typescript
   // Safe because same-origin
   iframe.contentWindow.document.documentElement.style.setProperty(...)
   ```

4. **HSL Color Conversion** - Project themes convert HEX → HSL
   ```typescript
   // Project theme uses HSL for Tailwind compatibility
   const hsl = hexToHSL("#ffffff"); // "0 0% 100%"
   iframeDoc.style.setProperty("--background", hsl);
   ```

5. **Settings Context** - App themes managed globally
   ```typescript
   // SettingsContext applies to workspace UI
   useEffect(() => {
     document.documentElement.style.setProperty("--glass-alpha", glassIntensity);
   }, [settings.appearance]);
   ```

### 📝 Theme Persistence

**Project Theme:**
```json
// data/workspaces/{jobId}/theme.json
{
  "meta": {
    "name": "Custom Dark",
    "createdAt": "2024-10-13T10:30:00Z",
    "author": "demo"
  },
  "colors": {
    "background": "#000000",
    "text": "#ffffff",
    ...
  }
}
```

**App Theme:**
```json
// data/settings/{userId}.json
{
  "appearance": {
    "theme": "dark",
    "glassIntensity": 75,
    "glossFinish": true,
    "fontSize": 14
  }
}
```

### 🔄 Theme Application Flow

**Project Theme (Preview):**
1. User opens ThemeModal
2. Adjusts colors/fonts
3. Clicks "Apply Preview" → Updates iframe immediately
4. Clicks "Save" → Persists to `theme.json`
5. Iframe reloads with saved theme

**App Theme (Workspace):**
1. User goes to Settings → Appearance
2. Adjusts glass intensity / font size
3. Changes apply immediately to workspace UI
4. Auto-saved to `{userId}.json`
5. Persists across sessions

## 🧪 Testing

### Manual Testing
1. **Generation Flow**
   - Enter prompt: "modern portfolio website"
   - Watch loading state (2-4s)
   - Verify generated site in modal
   
2. **Payment Flow**
   - Click "Buy Creator Plan"
   - Verify mock payment success
   - Check toast notification

3. **Authentication Flow**
   - Click Profile Icon → Sign In
   - Enter test@example.com / password123
   - Verify user initials appear in avatar
   - Navigate to My Library
   - Sign Out and verify profile resets

4. **Library Theme**
   - Navigate to /library
   - Verify diagonal black/red/blue bands
   - Toggle site theme (Library remains consistent)
   - Enable "Respect system theme"
   - Verify Library adapts to global theme

5. **OAuth Sign-In Flow**
   - Click Profile Icon → Sign In
   - Verify OAuth buttons visible: Google, Apple, Facebook, Twitter, GitHub
   - Click "Sign in with Google"
   - Verify signed in as demo-google@ybuilt.com
   - Sign out and try different provider
   - Verify each provider creates unique user

6. **Accessibility**
   - Tab through all interactive elements
   - Test screen reader (NVDA/JAWS)
   - Verify keyboard shortcuts

### E2E Test Scripts

YBUILT includes comprehensive end-to-end tests in the `test/` directory.

**Test Suites:**
1. **test/generate.test.js** - Generation flow tests
   - Homepage rendering
   - Prompt submission
   - Job polling
   - Preview modal
   - Error handling

2. **test/workflow.test.js** - Workspace workflow tests
   - Workspace initialization
   - File tree operations
   - Monaco editor interactions
   - Console streaming
   - Build trace viewer
   - Publishing flow

**Running Tests:**
```bash
# Run generation tests
node test/generate.test.js

# Run workspace tests
node test/workflow.test.js

# Run all tests
npm run test:e2e

# With custom URL
BASE_URL=http://localhost:3000 node test/generate.test.js
```

**Configuration:**
```javascript
// test/config.js
export const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
export const TIMEOUT = 30000;  // 30s per test
export const HEADLESS = process.env.HEADLESS !== 'false';
```

**Test Coverage (16 tests):**
- ✅ Homepage loads with hero section
- ✅ Prompt input accepts text
- ✅ Generation creates job ID
- ✅ Job status polling works
- ✅ Preview modal displays iframe
- ✅ Workspace loads file tree
- ✅ Editor highlights syntax
- ✅ Console streams logs
- ✅ Build trace shows pipeline
- ✅ File upload works (25MB limit)
- ✅ Theme modal persists changes
- ✅ Publishing deducts credits
- ✅ Error states show retry UI
- ✅ Auth flow works (mock mode)
- ✅ Payment modal opens
- ✅ Webhook verification passes

**CI/CD Integration:**
```yaml
# .github/workflows/test.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run dev &
      - run: npm run test:e2e
```

**Test Utilities:**
```javascript
// test/utils.js
export async function waitForElement(selector, timeout = 5000);
export async function fillForm(data);
export async function assertText(selector, expected);
export async function screenshot(name);
```

### Automated Testing (Future)
```bash
npm run test      # Jest unit tests (planned)
npm run test:int  # Integration tests (planned)
npm run coverage  # Coverage report (planned)
```

## 🔧 Configuration

### Design System
Edit `client/src/index.css` for glass/gloss variables:

```css
:root {
  --glass-alpha: 0.12;
  --glass-reflection: rgba(255,255,255,0.08);
  --rim-strength: rgba(255,255,255,0.10);
}
```

### Mock Worker
Customize templates in `server/queue.ts`:

```typescript
private generateMockHTML(prompt: string): string {
  // Add new template detection
  if (prompt.includes("your-keyword")) {
    template = "your-template";
  }
}
```

## 🚢 Deployment on Replit

### Auto-Deploy
1. Import this repo to Replit
2. Click "Run"
3. App auto-deploys to `.replit.app` domain

### Environment Setup
1. Add secrets in Replit Secrets panel
2. Restart app
3. Webhooks auto-configured

### Custom Domain
1. Go to Replit Deployments
2. Add custom domain
3. Configure DNS (automatic)

## 🔮 Future Enhancements

### MVP → Production
- [ ] Real OpenAI/Gemini integration for AI generation
- [ ] Redis + BullMQ for scalable job queue
- [ ] PostgreSQL for persistent storage
- [ ] User authentication with project history
- [ ] Multi-page website generation
- [ ] Export to GitHub/Zip
- [ ] Custom branding extraction
- [ ] Responsive preview modes

### Payment Expansion
- [ ] Cashfree/PayU secondary gateways
- [ ] Subscription plans
- [ ] Usage-based pricing
- [ ] Invoice generation

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please read CONTRIBUTING.md first.

## 💬 Support

- 📧 Email: support@ybuilt.com
- 💬 Discord: [Join Server](https://discord.gg/ybuilt)
- 🐛 Issues: [GitHub Issues](https://github.com/ybuilt/ybuilt/issues)

---

**Built with 🖤 by the ybuilt team**

*Powered by AI. Designed for humans.*
