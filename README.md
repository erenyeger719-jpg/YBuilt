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

### Environment Variables (Optional)

Create a `.env` file for real integrations:

```bash
# Razorpay (optional - runs in mock mode without)
RAZORPAY_KEY_ID=rzp_test_your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# OpenAI (for future real AI generation)
# OPENAI_API_KEY=sk-your-key-here

# Redis (for production queue)
# REDIS_URL=redis://localhost:6379
```

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

3. **Accessibility**
   - Tab through all interactive elements
   - Test screen reader (NVDA/JAWS)
   - Verify keyboard shortcuts

### Automated Testing
```bash
npm run test  # Unit tests (future)
npm run e2e   # Playwright tests (future)
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
