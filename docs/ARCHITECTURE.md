# nZO Ticketing — Architecture & Deployment

## Recommended stack (low cost, production-ready)

| Layer | Choice | Cost (start) |
|---|---|---|
| **Database** | **Supabase PostgreSQL** | Free → $25/mo |
| **Auth** | **Supabase Auth** (Google + phone OTP) | Included |
| **File storage** | **Cloudflare R2** or Supabase Storage | ~$0–5/mo |
| **Web app** | **Next.js 14 on Vercel** | Free → $20/mo |
| **CDN / DNS** | **Cloudflare** | Free |
| **Payments** | **Stripe** (+ local PG later) | Pay per transaction |
| **Email** | **Resend** | Free tier |
| **SMS (OTP)** | **Twilio** or local gateway | Pay per SMS |

**Estimated MVP cost: $0–25/month** · **At scale (~10k MAU): $50–150/month**

### Why PostgreSQL (Supabase)?

- Real enums, row-level security (RLS) for multi-tenant organizer scoping
- Built-in Auth, Realtime (live sales dashboard), Storage (event images)
- Easy migration from current Prisma schema (change `provider = "postgresql"`)
- Free tier is generous for launch

SQLite is fine for **local dev only** — not for production with multiple organizers and concurrent ticket sales.

---

## User roles

| Role | Access |
|---|---|
| **Customer** | Browse approved events, buy tickets, wallet, loyalty |
| **Super Admin** | Everything — approvals, all orgs, platform settings |
| **Organizer / Artist Manager / Business Owner** | `/portal` — own org events only, staff, scanner |
| **Event workers** | Assigned per event — scanner at entrance (2 free, then billed) |

---

## Deployment strategy

### Phase 1 — Demo / client preview (now)
```
Local: npm run dev + SQLite + demo login at /login
```

### Phase 2 — Staging
1. Create Supabase project → copy `DATABASE_URL`
2. Change `prisma/schema.prisma` provider to `postgresql`
3. `npx prisma migrate deploy`
4. Follow **`docs/VERCEL_DEPLOY.md`** (GitHub import, env vars, Supabase Auth URLs)
5. Set env vars in Vercel: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, etc.

### Phase 3 — Production
- Vercel production branch (`main`) — auto-deploy on push
- Supabase Pro when you need more connections
- Cloudflare in front for caching public event pages (optional)
- Stripe / WebXPay webhooks → payment callback routes (when live)

---

## MCP agents (Cursor)

To connect DB and deployment via MCP in Cursor:

1. **Supabase MCP** — add in Cursor Settings → MCP → Supabase server (query DB, run migrations from chat)
2. **Vercel MCP** — deploy previews, check logs from chat
3. **Stripe MCP** — test payments

We don't have these MCP servers configured in this workspace yet. To enable:
- Install official Supabase / Vercel MCP packages in `.cursor/mcp.json`
- Add API tokens as env vars (never commit secrets)

Until MCP is wired, use:
- Supabase Dashboard for DB
- Vercel Dashboard for deploys
- `npm run db:studio` locally

---

## Test scenarios (after `npm run db:seed`)

1. **Customer** — login `demo@customer.test` → buy Aurora VIP tickets → see barcode
2. **Organizer** — login `promoter@beatpulse.test` → `/portal` → submit draft / view pending
3. **Super Admin** — login `superadmin@nzo.test` → `/admin/approvals` → approve Colombo Jazz
4. **Scanner** — login `scanner@door.test` → `/portal` → Aurora → scan barcode
5. **Staff billing** — Aurora has 3 billable staff slots (1 beyond free 2)
