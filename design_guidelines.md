# YBUILT Design Guidelines
## Luxe Monochrome AI Website Builder

### Design Approach
**Reference-Based**: X.AI × Epic Games aesthetic - cinematic, tactile, restrained portal experience with ultra-HDR monochrome treatment and cohesive glass/gloss material system.

---

## Core Visual Identity

### Color Palette
**Strict Monochrome System** (No UI colors allowed):
- **Deepest Blacks**: #000000 (pure void)
- **Charcoal Greys**: #1a1a1a to #3a3a3a (midtones)
- **Light Greys**: #c0c0c0 to #e8e8e8
- **Pure Whites**: #ffffff (extreme highlights)
- **Accent Exception**: Micro metallic rim only in exported logo assets; sparse red-metallic for badges only

**Dynamic Range**: Push extreme contrast - deepest blacks, punchy midtones, crisp whites with strong specular highlights and subtle bloom effects.

---

## Material System (Glass & Gloss)

### Primary Surfaces (Panels, Cards, Logo)
- **Layered glass treatment**: Semi-translucent base with strong specular rim
- **Internal reflections**: Subtle environmental reflections with fresnel highlights
- **Soft bloom**: Delicate glow on rim edges
- **Variables**: `--glass-alpha: 0.12`, `--glass-reflection: rgba(255,255,255,0.08)`, `--rim-strength: rgba(255,255,255,0.10)`

### Text as Metallic-on-Glass
- **Dark backgrounds**: White-metallic with bright specular gradient + faint reflection
- **Light backgrounds**: Black-metallic with deep specular + inner shadow
- **Effect**: Slight bevel/inner-shadow for depth, reads like polished metal under glass surface

### UI Controls (Buttons, Icons)
- **Glass shards aesthetic**: Glossy face with thin near-white rim
- **Hover state**: Subtle inner glow (maintain accessible contrast)
- **Accessible contrast**: Ensure 4.5:1 minimum for body text

### 3D Preview Cards
- **Construction**: Extruded 3D glass blocks with glossy front face
- **Beveled sides**: Matte finish for contrast
- **Shadows**: Cast soft shadows + micro-reflections on surface
- **Arrangement**: 6-8 cards near hero bottom, tactile rim-lit appearance

### Logo Treatment
- **3D sculpted glass Y**: Refractive interior with specular highlights
- **Effects**: Micro-bloom and rim-light
- **Text integration**: "built" flush right with matching glass/metal treatment

---

## Background System

### Gradient Foundation
- **Full-bleed composition**: Left→right gradient (black → charcoal → near-white)
- **Layered elements**: 3D smoke ribbons, fine sand/particle flecks
- **Texture composite**: Ripple texture at subtle opacity

### Responsive Exports
- 8K, 4K, 2K, mobile AVIF/WebP formats
- Background subtly reflects in foreground glass surfaces for realism

---

## Typography

### Primary Font
**Valmeria** (custom luxury font)
- **Headline sizes**: 72-96px (desktop), 48-56px (mobile)
- **Body text**: 16-18px with 1.6 line-height
- **Metallic mapping**: Follow dark/light area rules for specular treatment

### Hierarchy
- **Hero Headline**: "From Idea to Digital Reality" (exact copy)
- **Tagline**: "Build smarter. Launch faster." (exact copy)
- **UI Labels**: Clean sans-serif for accessibility

---

## Layout System

### Composition Strategy
- **Diagonal/tilted layered planes**: 5-7 layers with varied textures
- **Depth separation**: Glass gloss, paper-origami folds (rabbit/tiger/elephant accents), brushed micrograin
- **Parallax depth**: Crisp layer separation readable at 4K and mobile

### Spacing Units
Tailwind units: 2, 4, 8, 12, 16, 20, 24, 32 (maintain consistent rhythm)

---

## Component Library

### Hero Section
- **Prompt box**: Glass slab inset with glossy rim and subtle Y reflection
- **Placeholder text**: Single input, minimal design
- **CTAs**: Primary "Create" button, Secondary "Explore previews" link
- **Preview showcase**: 6-8 3D cards arranged at hero bottom

### Preview Cards (Interactive)
- **Mini-carousel design**: Shows AI-generated websites/apps
- **Click behavior**: Opens modal with iframe to `/previews/{id}/index.html`
- **Visual treatment**: Extruded glass blocks with lift animation on hover

### Modals
- **Preview display**: Full iframe rendering of generated sites
- **Glass container**: Consistent material system
- **Keyboard navigable**: Full ARIA labels and accessible close controls

---

## Motion & Animation

### Restrained, High-Class Approach
- **Headline reveal**: Clip + opacity animation
- **Logo intro**: Scale + specular sweep + idle breathe effect
- **Parallax layers**: Subtle depth on scroll
- **Card interactions**: Lift + highlight sweep
- **Lottie elements**: Smoke/origami animations

### Accessibility
- **prefers-reduced-motion**: Full fallbacks for all animations
- **Toggle option**: "Low-gloss / high-contrast" mode persisted in localStorage

---

## Accessibility Features

### Inclusive Design
- **Keyboard navigation**: All modals and interactions
- **ARIA labels**: Complete semantic structure
- **Contrast ratios**: 4.5:1 minimum for text
- **Gloss toggle**: Low-gloss/high-contrast mode for reduced shine
- **Motion controls**: Respect system preferences + manual toggle

---

## User Experience Flow

### Creation Process
1. User enters prompt in hero glass slab input
2. Click "Create" → POST to /api/generate
3. Job created, client polls for completion
4. Completed site displays in iframe modal
5. Seamless, cinematic experience throughout

### Payment Integration
- **Razorpay demo**: Prominent "Buy Creator Plan ₹799" CTA
- **Currency toggle**: INR/USD display (UPI flows INR only)
- **India-first support**: UPI collect/intent, QR, netbanking, wallets, cards

---

## Images & Assets

### Required Assets
- **Hero background**: Ultra-HDR composite with ripple texture
- **Logo exports**: Glass Y (SVG + poster PNG with specular highlights)
- **Material reference**: `glass_matcap.webp` for environment reflections
- **Preview thumbnails**: 6-8 demo site screenshots for cards

### No Large Hero Image
This design relies on rendered backgrounds and 3D elements rather than photographic hero imagery. The visual impact comes from the glass/gloss material system, layered gradients, and sculpted 3D logo.

---

## Special Considerations

### Demo Mode (MOCK_MODE)
- Fully functional without real payment/AI keys
- Simulate 2-4s generation delay
- Include 8 complete demo preview pages
- Visual fidelity maintained in mock state

### Performance
- Lazy-load iframe previews
- Limit heavy Lottie loops
- Optimize glass effects for mobile
- Progressive enhancement for 3D elements

---

**Design Principle**: Every element should feel like polished glass under studio lighting - tactile, luxurious, and impossibly sharp. The monochrome palette creates drama through contrast and material, not color.