# nZO Ticketing - Supabase Backend

This document describes the **live Supabase backend** (database, auth, storage),
how the app connects to it, and the system flow.

---

## 1. Connection info

| Item | Value |
|------|-------|
| Project ref | `fxoyitlauwbcdcwqrwge` |
| API URL | `https://fxoyitlauwbcdcwqrwge.supabase.co` |
| Publishable key (public) | `sb_publishable_opEA2waGNKRPkMIHdtzPzg_Vdyb9INj` |
| DB host (pooler) | `aws-1-ap-south-1.pooler.supabase.com` (region: Mumbai) |
| DB name / user | `postgres` / `postgres.fxoyitlauwbcdcwqrwge` |

The publishable/anon key is **safe to expose** in the browser - every table has
RLS enabled with no public policies, so the key can't read or write app data.

### Environment variables (`.env`)

```bash
# Runtime (PgBouncer pooler, port 6543)
DATABASE_URL="postgresql://postgres.fxoyitlauwbcdcwqrwge:[DB-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
# Migrations (direct/session, port 5432)
DIRECT_URL="postgresql://postgres.fxoyitlauwbcdcwqrwge:[DB-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

NEXT_PUBLIC_SUPABASE_URL="https://fxoyitlauwbcdcwqrwge.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_opEA2waGNKRPkMIHdtzPzg_Vdyb9INj"
```

> **You must do one thing:** open Supabase Dashboard → **Project Settings →
> Database → Connection string**, copy your **database password** and the exact
> **region** (e.g. `aws-0-ap-southeast-1`), and replace `[DB-PASSWORD]` and
> `<region>` in `.env`. Then `npm run dev`.

For Vercel: add the same four variables under **Project → Settings →
Environment Variables**.

### Verification plane (isolated Supabase project)

Separate project for the B2B card-validation API (`VERIFY_*` env vars). **Same
region as core** (Mumbai) to avoid cross-region sync latency.

| Item | Value |
|------|-------|
| Project ref | `vzvxphcdcmahwwgadrlp` |
| API URL | `https://vzvxphcdcmahwwgadrlp.supabase.co` |
| DB host (pooler) | `aws-1-ap-south-1.pooler.supabase.com` (region: Mumbai) |
| DB user | `postgres.vzvxphcdcmahwwgadrlp` |

```bash
# Runtime (PgBouncer pooler, port 6543)
VERIFY_DATABASE_URL="postgresql://postgres.vzvxphcdcmahwwgadrlp:[VERIFY-DB-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&pool_timeout=20&sslmode=require"
# Migrations (direct/session, port 5432)
VERIFY_DIRECT_URL="postgresql://postgres.vzvxphcdcmahwwgadrlp:[VERIFY-DB-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

Provision schema: `npm run verify:guard && npm run db:push:verify && npm run db:seed:verify`.
See `docs/VERIFICATION_RUNBOOK.md`.

For Vercel production: add `VERIFY_DATABASE_URL`, `VERIFY_DIRECT_URL`, and all
`VERIFY_KMS_*` / `VERIFY_HASH_PEPPER` variables from `.env.example`.

---

## 2. Data access architecture

```
Browser ──┬─ Supabase Auth (login/signup/session)  → cookies
          │
Next.js ──┼─ Prisma (postgres role) ───────────────→ Supabase Postgres  (all reads/writes)
          └─ Supabase Storage (event images)
```

- **Auth** is handled by Supabase Auth. The browser/server use the
  `@supabase/ssr` clients (`src/lib/supabase/*`). Sessions live in cookies and are
  refreshed by `src/middleware.ts`.
- **Data** is read/written with **Prisma** through the pooled connection. Prisma
  connects as the `postgres` role, which **bypasses RLS** - so all existing query
  code keeps working unchanged.
- **RLS** is enabled on every table with **no public policy**, locking the
  publishable key out of direct table access. (Security advisor shows these as
  INFO "RLS enabled, no policy" - that is intentional.)

---

## 3. Tables

All app tables live in the `public` schema (PascalCase, created from the Prisma
schema). 22 tables in total:

| Group | Tables |
|-------|--------|
| **Users / Auth** | `User` (profile, mirrors `auth.users`), `Address` |
| **Organizations** | `Organization`, `OrganizationMember` |
| **Catalog** | `Category`, `Venue`, `SeatPrice` |
| **Events** | `Event`, `EventImage`, `EventPartner`, `TicketPackage`, `EventApprovalLog`, `EventStaff` |
| **Commerce** | `Cart`, `CartItem`, `Order`, `OrderItem`, `Ticket` |
| **Loyalty / Ops** | `LoyaltyEntry`, `AdminAlert`, `AuditLog`, `PlatformSettings` |

Key relationships:

- `User 1-* Organization (owner)`, `User *-* Organization (OrganizationMember)`
- `Organization 1-* Event`, `Event 1-* TicketPackage / EventImage / EventStaff`
- `Event 1-* EventApprovalLog` (approval audit trail)
- `Order 1-* OrderItem 1-* Ticket` (tickets keep legacy internal codes, but gate lookup uses NIC, passport number or Entertain Passport NFC)

### `User` ↔ `auth.users` sync

`public.User.id` equals `auth.users.id`. A trigger keeps them in sync:

- `on_auth_user_created` → inserts a `User` profile on signup. It copies
  `firstName`, `lastName`, combined `name`, `role`, `idType`, and `idNumber`
  from `raw_user_meta_data` (default role `CUSTOMER`, default `idType = NIC`).
  `idNumber` is the canonical customer identity number for either `NIC` or
  `PASSPORT`; `nic` is kept as a legacy mirror only when `idType = NIC`.
- `on_auth_user_updated` → keeps email, role and customer identity metadata in
  sync.

---

## 4. Storage

Bucket **`event-images`** (public, 10 MB limit, image mime types only).

- Public **read** via object URLs.
- **Insert/update/delete** restricted to authenticated users (owner-scoped for
  update/delete).

---

## 5. Migrations applied

| Version | Name |
|---------|------|
| `…094951` | `init_nzo_ticketing_schema` - all 22 tables, FKs, indexes |
| `…095021` | `auth_user_sync_and_rls` - auth triggers + RLS on all tables |
| `…095037` | `storage_event_images_bucket` - storage bucket + policies |
| `…095201` | `seed_auth_users` - 6 auth users + profiles + platform settings |
| `…095227` | `seed_catalog_orgs` - categories, venues, organizations, members |
| `…095318` | `seed_events` - 8 events, images, packages, approval logs |
| `…095400` | `seed_staff_orders_tickets` - event staff + 1 paid order + 2 tickets |
| `…095437` | `security_hardening` - locked trigger fns + tightened storage policy |
| `profile_currency_commission_location` | User profile fields, structured address, org/event commission, `Event.currency`, LKR + 5% backfill |
| `scripts/update-auth-user-sync-nic.sql` | Auth trigger update for customer `firstName`, `lastName`, `idType`, `idNumber` identity metadata |

---

## 6. Example accounts

All seeded accounts share the password **`Password123!`**. These are now
**real example accounts** (no demo quick-fill buttons on the login page) - sign
in by entering the email/password manually. Look them up in the DB as needed.

| Email | Role | Creator type (Organization.type) | Lands on |
|-------|------|----------------------------------|----------|
| `superadmin@nzo.test` | SUPER_ADMIN | - | `/admin` (sign in via `/third-eye/999/login`) |
| `promoter@beatpulse.test` | ORGANIZER | ORGANIZER (Event Organizer) | `/portal` |
| `artist@mayaray.test` | ORGANIZER | ARTIST_MANAGER (Artist Manager) | `/portal` |
| `venue@lumina.test` | ORGANIZER | BUSINESS_OWNER (Company/Venue Owner) | `/portal` |
| `scanner@door.test` | ORGANIZER | member (WORKER) + EventStaff SCANNER | `/portal` |
| `demo@customer.test` | CUSTOMER | - | `/account/tickets` |

### Auth doors

- **Customers** sign in / sign up at `/login` (role `CUSTOMER`). After signup
  they are sent to `/account/profile` to complete their profile (skippable).
- **Event creators** sign in / sign up at `/organizer/login` (reached via the
  public `/promoters` landing). Signup includes a **creator-type dropdown**
  (Event Organizer / Artist Manager / Company-Venue Owner) → role `ORGANIZER`
  with the chosen `Organization.type`. The org is bootstrapped on first portal
  visit from signup metadata.
- **Super Admin** signs in at the hidden `/third-eye/999/login`.

### Currency & commission

- The platform runs in **LKR** (`src/lib/money.ts` is the multi-currency source
  of truth; other currencies are pre-defined but disabled for the future
  world-wide rollout). `Event.currency` / `Order.currency` default to `LKR`.
- Default **platform commission is 5%** (`PlatformSettings.defaultCommissionPct`).
  Super Admin can override per-organization (`Organization.commissionPct`) and
  per-event. Organizers see it read-only in the create-event wizard.

### Profile & loyalty

- `User` gained `firstName`, `lastName`, primary unique `idNumber` for NIC or
  passport identity (`idType` defaults to `NIC`), plus optional `gender` and `birthday`.
  `Address` gained `district`, `province`, `isPrimary`. A complete profile
  unlocks loyalty rewards and card delivery (`src/lib/profile.ts`).

### Payments

- Checkout is wired for **WebXPay** (Visa / Mastercard / Amex). **KOKO**
  pay-later is shown as "coming soon".

---

## 7. System flow

### 7.1 Roles & high-level system

```mermaid
flowchart TD
    subgraph Public
      C[Customer]
    end
    subgraph Platform
      SA[Super Admin]
    end
    subgraph Orgs
      O[Organizer / Artist Mgr / Business Owner]
      W[Event Door Staff]
    end

    C -->|browse & buy| APP[nZO Ticketing - Next.js]
    SA -->|approve & manage| APP
    O -->|create & submit events| APP
    W -->|scan tickets| APP

    APP -->|Supabase Auth| AUTH[(auth.users)]
    APP -->|Prisma| DB[(Supabase Postgres)]
    APP -->|images| ST[(Supabase Storage)]
    AUTH -.trigger.-> DB
```

### 7.2 Auth & session

```mermaid
sequenceDiagram
    participant U as User (browser)
    participant S as Supabase Auth
    participant M as Next.js middleware
    participant DB as Postgres (Prisma)

    U->>S: signInWithPassword(email, pw)
    S-->>U: session cookies
    U->>M: request page
    M->>S: refresh session (getUser)
    M-->>U: forward refreshed cookies
    U->>DB: getSession() -> join User profile
    DB-->>U: { id, email, role }
    Note over U: role routes to /admin, /portal or /account
```

### 7.3 Event lifecycle (approval gate)

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PENDING_REVIEW: organizer submits
    PENDING_REVIEW --> APPROVED: super admin approves → status=PUBLISHED
    PENDING_REVIEW --> CHANGES_REQUESTED: needs edits
    PENDING_REVIEW --> REJECTED: declined
    CHANGES_REQUESTED --> PENDING_REVIEW: resubmit
    REJECTED --> PENDING_REVIEW: resubmit
    APPROVED --> [*]: visible to customers
```

Only events with `status = PUBLISHED` **and** `approvalStatus = APPROVED` appear
on the public site.

### 7.4 Purchase → ticket issuance → door check-in

```mermaid
flowchart LR
    A[Customer adds packages to cart] --> B[Checkout]
    B --> C{Signed in?}
    C -- no --> L[/login next=/checkout/]
    C -- yes --> D[POST /api/checkout]
    D --> E[createPaidOrder transaction]
    E --> F[Order = PAID]
    E --> G[Issue tickets linked to NIC/passport identity or Entertain Passport]
    E --> H[Decrement package availability + award loyalty]
    G --> I[My Tickets page]
    I --> J[Door staff verifies NIC/passport number or taps Passport card]
    J --> K[POST /api/gate/check-in -> status CHECKED_IN]
```

> Payment is currently mocked (order is created as PAID immediately). When
> **WebXPay** is integrated, create the order as `PENDING` first and only flip to
> `PAID` + issue tickets inside the payment callback.

---

## 8. Regenerating the schema

The Postgres DDL is generated from `prisma/schema.prisma`. To reproduce:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

Apply schema changes to Supabase via the Supabase MCP `apply_migration`, then run
`npx prisma generate` locally.
