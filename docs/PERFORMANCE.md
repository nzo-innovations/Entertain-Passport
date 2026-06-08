# Entertain Passport — Performance & Scale Guide

Target: **100 concurrent users**, **10k registered users**, **100 events** without noticeable slowdown on login, event browsing, and checkout.

---

## What the app does today

| Layer | Optimization |
|-------|----------------|
| **Database indexes** | Events (status+approval+date), packages, orders, venues, RFID lookup |
| **Public page cache** | `revalidate: 60` + `unstable_cache` for events, categories, venues |
| **Middleware** | Skips Supabase auth refresh for anonymous visitors |
| **Auth** | React `cache()` dedupes Supabase + DB per request; login role check fetches only `role` column |
| **Event listings** | Lean `select` queries (no full description blob) |
| **Checkout** | Parallel package+passport fetch; atomic inventory lock; parallel `createMany` tickets |
| **Gate check-in** | Lean ticket lookup; parallel permission checks |
| **Connection pool** | `connection_limit=5` in dev (use 1 per serverless instance in prod) |

---

## Production deployment checklist

### 1. Host on Vercel (or similar) — not `npm run dev`

```bash
npm run build
npm start   # local prod test
```

Dev mode compiles on every change and is **10–20× slower** than production.

### 2. Supabase Pro + compute

- Avoid free-tier **project pause** (adds seconds to first request)
- Mumbai region matches your DB — deploy app to `ap-south-1` if possible
- Use **Transaction pooler** (port 6543) with `pgbouncer=true`

**Production `.env` (Vercel):**

```bash
DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true&connection_limit=1"
```

Use `connection_limit=1` **per serverless function** — Vercel scales instances, each gets its own connection.

### 3. Environment variables on Vercel

Copy all vars from `.env.example`. Set `NEXT_PUBLIC_SITE_URL` to your production domain.

### 4. Cache invalidation

When Super Admin approves an event, `revalidateTag('events')` runs automatically.

After bulk data changes, redeploy or call revalidation from admin tooling.

---

## Expected response times (production, warm cache)

| Path | Target |
|------|--------|
| Home / Events list | 100–400 ms |
| Event detail | 100–300 ms |
| Login (auth/role) | 200–500 ms |
| Checkout API | 300–800 ms |

100 concurrent users is well within capacity for this data size **when deployed in production mode**.

---

## Checkout under load

- Inventory uses **conditional `updateMany`** — two users cannot buy the last ticket
- Tickets created with **`createMany`** (batch insert)
- Payment gateway (WebXPay): keep order as `PENDING` until callback confirms, then issue tickets (future hardening)

---

## If you outgrow 100 concurrent users

1. Supabase **compute upgrade** (Small → Medium)
2. **Read replicas** for public event reads (advanced)
3. **Redis** (Upstash) for session/event cache across instances
4. CDN for event images (Supabase Storage + CDN)

---

## Monitoring

- Supabase Dashboard → **Database → Query performance**
- Vercel → **Analytics / Speed Insights**
- Watch for `connection pool timeout` in logs → increase compute or reduce parallel queries
