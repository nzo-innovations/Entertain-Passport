# Entertain Passport

A modern, low-cost ticketing platform by nZO Innovations. Your passport to every event - buy tickets and tap your NFC Entertain Passport at the gate.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** with shadcn-style UI primitives
- **Prisma + SQLite** for local dev (swap to Postgres in production)
- **Framer Motion** for cinematic motion
- **Recharts** for analytics
- **Zustand** for client cart state
- **Lucide** icons, **Inter / Space Grotesk** typefaces

## Folder structure

```
src/
  app/
    (public)/                  # Customer-facing routes (header + footer)
      page.tsx                 # Landing page
      events/page.tsx          # Browse + filters + search
      events/[slug]/page.tsx   # Event detail (gallery, packages, partners, T&C)
      checkout/page.tsx        # Mock checkout
      login/page.tsx           # Auth UI
    admin/
      layout.tsx               # Admin shell (sidebar + topbar)
      page.tsx                 # Real-time analytics dashboard
      events/page.tsx          # Event list
      events/new/page.tsx      # Publish-event wizard (5 steps)
    account/tickets/page.tsx   # Wallet / order confirmation
    layout.tsx                 # Root layout (theme + toaster)
    globals.css                # Design tokens (light + dark)
    not-found.tsx
  components/
    ui/                        # Buttons, cards, dialogs, sheets, toasts
    marketing/                 # Hero, value props, organizer CTA, category strip
    events/                    # EventCard, EventGrid, FilterBar, ImageGallery, PackageSelector
    cart/                      # CartDrawer
    admin/                     # StatCard, SalesChart
    shared/                    # Header, Footer, Logo, ThemeToggle, ThemeProvider
  lib/
    db.ts                      # Prisma singleton
    events.ts                  # Query helpers (cards, by-slug, categories)
    cart-store.ts              # Zustand cart with localStorage persistence
    format.ts                  # Date/time formatters
    utils.ts                   # cn(), currency
    types.ts                   # String-literal enums (UserRole, EventStatus, ...)
prisma/
  schema.prisma                # Full schema (User, Event, TicketPackage, Order, Loyalty, Alerts...)
  seed.ts                      # 8 realistic events, 4 venues, 8 categories
```

## Local dev

```powershell
npm install
npm run db:push      # creates prisma/dev.db
npm run db:seed      # seeds demo data
npm run dev          # http://localhost:3000
```

## Demo flows

- `/` cinematic hero, featured events, categories, organizer CTA
- `/events` browse with category pills + search
- `/events/aurora-nights-stadium-tour` event detail \u2014 gallery, multi-package selector, cart
- Add tickets from multiple events, then `/checkout` for the full purchase flow
- `/admin` real-time-style analytics dashboard with chart and threshold alerts
- `/admin/events/new` 5-step publish-event wizard (the client-facing magic moment)

## Production migration path

1. Swap `datasource db` provider in `prisma/schema.prisma` to `postgresql`.
2. Convert string status fields back to Prisma enums (mappings live in `src/lib/types.ts`).
3. Add Supabase Auth / Clerk for real Google + phone OTP.
4. Add Stripe for real payments (the checkout page is structured to drop a Payment Intent in).
5. Replace seeded images with Cloudflare R2 / Supabase Storage uploads.
6. Extract `src/app/api/v1/*` into a standalone NestJS service when mobile launches.
