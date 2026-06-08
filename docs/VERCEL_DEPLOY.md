# Entertain Passport — Initial Vercel Deployment Guide

**For:** First production (or staging) deploy  
**Stack:** Next.js 14 → **Vercel** · Postgres/Auth/Storage → **Supabase**

> **Short answer:** Connecting GitHub to Vercel is **necessary but not sufficient**. You must also set **environment variables**, configure **Supabase Auth URLs**, and confirm the **database** is reachable before the app works in production.

---

## Table of contents

1. [What you need before starting](#1-what-you-need-before-starting)
2. [Recommended deployment shape](#2-recommended-deployment-shape)
3. [Step-by-step: first deploy](#3-step-by-step-first-deploy)
4. [Environment variables (Vercel)](#4-environment-variables-vercel)
5. [Supabase production settings](#5-supabase-production-settings)
6. [After first deploy — verification](#6-after-first-deploy--verification)
7. [Ongoing CD (GitHub → Vercel)](#7-ongoing-cd-github--vercel)
8. [Custom domain (optional)](#8-custom-domain-optional)
9. [Cost & plan recommendations](#9-cost--plan-recommendations)
10. [Troubleshooting](#10-troubleshooting)
11. [Checklist (printable)](#11-checklist-printable)

---

## 1. What you need before starting

| Item | Status |
|------|--------|
| GitHub repo pushed (`main` branch) | `nZO-Innovations/Entertain-Passport` |
| Supabase project (Postgres + Auth + Storage) | See `docs/SUPABASE.md` |
| Vercel account | [vercel.com](https://vercel.com) — **Pro** for commercial production |
| Domain (optional) | e.g. `tickets.yourdomain.com` |
| Local build passes | Run `npm run build` locally first |

**Do not commit** `.env` to GitHub. Secrets go only in Vercel **Environment Variables**.

---

## 2. Recommended deployment shape

```
┌─────────────┐     push main      ┌─────────────┐
│   GitHub    │ ─────────────────► │   Vercel    │
│   main      │     auto build     │  (Next.js)  │
└─────────────┘                    └──────┬──────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              Supabase Auth         Supabase Postgres      Supabase Storage
              (login/signup)          (Prisma)               (event-images)
```

| Environment | Branch | Purpose |
|-------------|--------|---------|
| **Production** | `main` | Live users |
| **Preview** | feature branches / PRs | QA before merge |
| **Local** | — | `npm run dev` |

**Region:** Prefer **Mumbai (`bom1`)** on Vercel to match Supabase (ap-south-1) and reduce latency.

---

## 3. Step-by-step: first deploy

### Step 1 — Verify local build

```bash
npm install
npm run build
```

If this fails, fix errors before deploying.

### Step 2 — Prepare Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Confirm schema is applied (migrations or `npx prisma db push` from your machine using `DIRECT_URL`).
3. Optional: run `scripts/backfill-creator-roles.sql` if legacy test users need role alignment.
4. Upgrade to **Supabase Pro** for production (no project pause, better connections).

### Step 3 — Create Vercel project

1. Log in to [Vercel](https://vercel.com).
2. **Add New → Project**.
3. **Import** Git repository `Entertain-Passport` (GitHub OAuth if first time).
4. Vercel auto-detects **Next.js** — leave defaults unless noted below:

| Setting | Value |
|---------|--------|
| Framework Preset | Next.js |
| Root Directory | `./` |
| Build Command | `npm run build` (default) |
| Output Directory | (default) |
| Install Command | `npm install` (runs `postinstall` → `prisma generate`) |

5. **Do not click Deploy yet** — add environment variables first (Step 4).

### Step 4 — Add environment variables

In Vercel → Project → **Settings → Environment Variables**, add every variable from [Section 4](#4-environment-variables-vercel).

Apply to: **Production**, **Preview**, and **Development** (Preview can use same Supabase or a separate staging project).

### Step 5 — Set region (optional but recommended)

Project → **Settings → Functions** → Region → **Mumbai (bom1)** if available.

### Step 6 — Deploy

Click **Deploy** (or push to `main` after import).

First build takes ~2–4 minutes. Watch the build log for:

- `prisma generate` success
- `next build` success
- No missing env var errors

### Step 7 — Configure Supabase Auth for production URL

After deploy, Vercel gives you a URL like `https://nZO-Innovations.Entertain-Passport.vercel.app`.

Update Supabase (see [Section 5](#5-supabase-production-settings)) **before** testing login.

### Step 8 — Smoke test

Use **Section 6** or the quick list in `docs/QA_MANUAL_TEST_GUIDE.md` (Section 5).

---

## 4. Environment variables (Vercel)

Copy from `.env.example`. Use **Production** values below.

| Variable | Production value | Notes |
|----------|------------------|-------|
| `DATABASE_URL` | Pooled URL, port **6543**, `pgbouncer=true`, **`connection_limit=1`** | Required for serverless |
| `DIRECT_URL` | Direct URL, port **5432** | Not used at runtime on Vercel; keep for local migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key | Public |
| `NEXT_PUBLIC_APP_NAME` | `Entertain Passport` | Public |
| `NEXT_PUBLIC_APP_TAGLINE` | Your tagline | Public |
| `NEXT_PUBLIC_SITE_URL` | **`https://your-production-domain.com`** | Must match live URL (no trailing slash) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **Server only** — gate staff creation |

**Production `DATABASE_URL` example (replace password):**

```bash
postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Important:**

- Use `connection_limit=1` on Vercel (not `5` like local dev).
- Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`.
- After adding/changing env vars, **Redeploy** production.

---

## 5. Supabase production settings

In Supabase → **Authentication → URL Configuration**:

| Field | Example |
|-------|---------|
| **Site URL** | `https://nZO-Innovations.Entertain-Passport.vercel.app` or your custom domain |
| **Redirect URLs** | Add all of these (one per line): |

```
https://YOUR_DOMAIN/auth/callback
https://YOUR_DOMAIN/auth/complete
https://YOUR_DOMAIN/**
https://*.vercel.app/auth/callback
https://*.vercel.app/auth/complete
```

Preview deploys use `*.vercel.app` — include wildcard patterns so PR previews can log in.

**Storage:** Bucket `event-images` must exist (see `docs/SUPABASE.md`).

**Email auth:** If email confirmation is enabled, test signup on production after Site URL is updated.

---

## 6. After first deploy — verification

Run these in order on the **production URL**:

| # | Test | Pass? |
|---|------|-------|
| 1 | Home `/` loads with styled UI | |
| 2 | `/events` shows published events | |
| 3 | Customer login `/login` with `demo@customer.test` | |
| 4 | Organizer login `/organizer/login` with `promoter@beatpulse.test` | |
| 5 | Admin login `/third-eye/999/login` with `superadmin@nzo.test` | |
| 6 | Upload image in portal event wizard | |
| 7 | Checkout (mock payment) completes | |
| 8 | Admin → Gate staff page loads | |

Password for seeded accounts: **`Password123!`** (see `docs/SUPABASE.md`).

Full QA: `docs/QA_MANUAL_TEST_GUIDE.md`.

---

## 7. Ongoing CD (GitHub → Vercel)

Once connected, **every push to `main` automatically**:

1. Triggers a Vercel build
2. Runs `npm install` + `prisma generate` + `next build`
3. Promotes to **Production** if build succeeds

| Action | Result |
|--------|--------|
| Push to `main` | Production deploy |
| Push to feature branch / open PR | Preview deploy (unique URL) |
| Change env var in Vercel | Requires **Redeploy** to take effect |

**CD is included** — you pay for **build minutes** only if you exceed plan allowance (unlikely at normal pace). See cost notes in Section 9.

**Best practices:**

- Merge feature branches via PR; use Preview URL for QA
- Avoid pushing broken builds to `main` — run `npm run build` locally first
- Set **Spend Management** in Vercel Billing (e.g. notify at $50)
- Database migrations: run locally with `DIRECT_URL`, not during Vercel build:

```bash
npx prisma db push    # or migrate deploy
```

---

## 8. Custom domain (optional)

1. Vercel → Project → **Settings → Domains** → Add domain.
2. Add DNS records at your registrar (Vercel shows CNAME/A records).
3. Update `NEXT_PUBLIC_SITE_URL` to `https://yourdomain.com`.
4. Update Supabase **Site URL** and **Redirect URLs** to the same domain.
5. Redeploy.

---

## 9. Cost & plan recommendations

Based on target scale (~100k registered users, ~10k requests/day):

| Service | Plan | Est. monthly |
|---------|------|--------------|
| **Vercel** | Pro (1 seat) | ~$20–25 |
| **Supabase** | Pro | ~$25+ |
| **Domain** | Registrar | ~$1/mo amortized |

**Vercel Pro** — required for commercial use, higher build limits, spend controls.  
**Hobby** — OK for personal demos only; not for Entertain Passport production.

Idle production (~$20/mo Vercel) + normal CD (~10–30 deploys/month) stays within included build allowance.

Scaling path (no microservices needed yet): `docs/PERFORMANCE.md`.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Unstyled UI / 404 on `_next/static` | Stale cache or failed build | Redeploy; hard refresh browser |
| `Can't reach database` | Wrong `DATABASE_URL` or pooler | Use port 6543 + `pgbouncer=true` |
| Login works locally, fails on Vercel | Supabase Site URL / redirects | Update Auth URL config (Section 5) |
| Gate staff cannot be created | Missing `SUPABASE_SERVICE_ROLE_KEY` | Add in Vercel env, redeploy |
| Images broken | Storage bucket or hostname | Check `event-images` bucket; `NEXT_PUBLIC_SUPABASE_URL` set at build |
| Build fails on Prisma | Missing `DATABASE_URL` at build | Add env vars to Production + Preview |
| `connection pool timeout` | Too many DB connections | Use `connection_limit=1`; upgrade Supabase compute |

**Build logs:** Vercel → Deployments → select deployment → **Building** tab.  
**Runtime logs:** Deployments → **Functions** / **Runtime Logs**.

---

## 11. Checklist (printable)

### Pre-deploy

- [ ] `npm run build` passes locally
- [ ] Code pushed to GitHub `main`
- [ ] Supabase schema up to date
- [ ] Supabase Pro active (production)
- [ ] Vercel Pro team ready

### Vercel project

- [ ] GitHub repo imported
- [ ] All env vars set (Section 4)
- [ ] Region = Mumbai if available
- [ ] First deploy succeeded

### Supabase

- [ ] Site URL = production domain
- [ ] Redirect URLs include `/auth/callback` and preview wildcards
- [ ] Storage bucket `event-images` exists

### Post-deploy

- [ ] Smoke tests (Section 6) pass
- [ ] `NEXT_PUBLIC_SITE_URL` matches browser URL
- [ ] Spend management enabled on Vercel
- [ ] QA handover doc shared: `docs/QA_MANUAL_TEST_GUIDE.md`

---

## Related docs

| Doc | Purpose |
|-----|---------|
| `docs/SUPABASE.md` | Database, seed accounts, storage |
| `docs/QA_MANUAL_TEST_GUIDE.md` | Full manual test plan |
| `docs/PERFORMANCE.md` | Scale & production tuning |
| `docs/ARCHITECTURE.md` | Stack overview |
| `.env.example` | Env var template |

---

*Initial deploy is a one-time setup (~30–60 minutes). After that, pushing to `main` is enough for routine updates.*
