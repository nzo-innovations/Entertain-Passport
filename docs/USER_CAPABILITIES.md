# Entertain Passport — User Roles & Capabilities

Platform: **Entertain Passport** by nZO Innovations  
Auth: Supabase (email/password + OAuth callback)

---

## 1. Role overview

| Auth role | Login door | Default landing | Session |
|-----------|------------|-----------------|---------|
| **Customer** | `/login` | `/account/tickets` | 7 days, shared across tabs |
| **Organizer** | `/organizer/login` | `/portal` | 7 days |
| **Gate Staff** | `/organizer/login` | `/gate` | 30 days, **one browser window** |
| **Super Admin** | `/third-eye/999/login` | `/admin` | 7 days |

Organizers choose an **organization type** at signup (stored on `Organization.type`):

| Org type | Label | Primary use |
|----------|-------|-------------|
| `ORGANIZER` | Event Organizer | Concerts, festivals, shows |
| `ARTIST_MANAGER` | Artist Manager | Artist tours, launches |
| `ARTIST` | Artist (self-managed) | Own shows without a manager |
| `BUSINESS_OWNER` | Company / Venue Owner | Pubs, cafés, clubs, dating spots |

All org types share auth role `ORGANIZER` and the **Organizer Portal**, except **My Venue** (Places to Go publishing) which is **Business Owner only**.

---

## 2. Common capabilities (all signed-in users)

| Capability | Who |
|------------|-----|
| Sign in / sign out | All roles |
| Theme toggle (light/dark) | All |
| View public site (Discover, Shows, Genres, Places to Go) | All |
| Session refresh via middleware | All |

---

## 3. Public (no login required)

| Area | URL | Description |
|------|-----|-------------|
| Discover | `/` | Featured & upcoming approved events |
| Shows | `/events` | Browse, search, filter by category |
| Event detail | `/events/[slug]` | Packages, gallery, add to cart |
| Genres | `/genres` | Category browse |
| Places to Go | `/venues` | Published pubs, cafés, clubs (filter by type, city, live nights, tickets) |
| Place detail | `/venues/[slug]` | Weekly program + ticketed shows at venue |
| Checkout | `/checkout` | Cart & payment (card via WebXPay) |

Only **published + approved** events and **published** venue profiles appear publicly.

---

## 4. Customer (ticket buyer)

**Login:** `/login`

### Capabilities

| Feature | Route / API | Notes |
|---------|-------------|-------|
| Browse & buy tickets | Public events + checkout | Cart persists in browser (Zustand) |
| View my tickets | `/account/tickets` | QR/barcode, check-in status |
| Complete profile | `/account/profile` | Optional for purchase; **required for loyalty rewards** |
| Assign tickets to friends | Ticket assign UI | By Entertain Passport no. or NIC |
| Earn loyalty points | Checkout | 1 point per LKR 100 spent (when profile complete) |
| Entertain Passport (RFID) | Checkout / tickets | Link NFC card to ticket for tap check-in |

### Unique to customers

- Loyalty program eligibility (`profileIsComplete()`)
- Bulk ticket assignment to friends/guests
- Customer-only login door (organizers/gate/admin rejected)

---

## 5. Organizer portal

**Login:** `/organizer/login`  
**Portal:** `/portal`

Shared by: Event Organizer, Artist Manager, Artist, Company/Venue Owner, and Gate Staff accounts that also hold org membership (gate staff primary role redirects to `/gate`).

### Common organizer capabilities

| Feature | Route | Notes |
|---------|-------|-------|
| Dashboard | `/portal` | Stats, pending approvals, shortcuts |
| My events | `/portal/events` | Events owned by org or tagged as artist |
| Create event | `/portal/events/new` | Guided wizard; submits for platform review |
| Manage event | `/portal/events/[id]` | Submit, staff, artists, ticket codes, check-in log |
| Edit event | `/portal/events/[id]/edit` | Update draft / changes requested |
| Event scanner | `/portal/events/[id]/scan` | QR/manual check-in (if permitted) |
| Team | `/portal/team` | Add/update/remove gate staff accounts |

### Event lifecycle (organizers)

1. Create event → `DRAFT` + `PENDING_REVIEW`
2. Super Admin approves → `PUBLISHED` + `APPROVED` → visible on Shows
3. Reject / changes requested → organizer edits and resubmits

### Event staff roles (per event)

Assigned by org owner/admin on event detail page.

| Role | Scan tickets | Roll back check-in |
|------|--------------|-------------------|
| **Scanner** | Yes | No |
| **Door Manager** | Yes | No |
| **Event Manager** | Yes | Yes |
| Org Owner / Admin | Yes | Yes |

First **2 staff per event** are free; additional staff may incur platform fee (configurable).

### Unique by organization type

| Org type | Extra capability |
|----------|------------------|
| **Business Owner** | **My Venue** `/portal/venue` — publish place on Places to Go, weekly program (no tickets), link ticketed events to venue profile |
| **Artist / Artist Manager** | Tagged on events via **Artist tagger**; see events where org is performing artist |
| **Event Organizer** | Full event publishing workflow (default) |

Business owners creating ticketed events can **reuse venue profile** in the event wizard (no duplicate address).

---

## 6. Gate staff

**Login:** `/organizer/login` (same door as organizers)  
**Console:** `/gate`, `/gate/[eventId]`

### Capabilities

| Feature | Description |
|---------|-------------|
| View assigned events | Only events where user is event staff or org worker |
| Check-in console | RFID wedge, manual code, search |
| Lookup & log | Paginated attendee list, filters (checked in / pending) |
| Purchase details | Buyer info, order tickets, holder labels (Buyer, Guest, Unknown member) |
| Roll back check-in | **No** (Event Manager / org admin only) |

### Unique session rules

- **30-day** session TTL
- **Per browser window** — new tab/window must sign in again (`WindowSessionGuard`)
- Logout clears window session cookies + `sessionStorage`

---

## 7. Super Admin

**Login:** `/third-eye/999/login`  
**Panel:** `/admin`

### Capabilities

| Module | Route | Description |
|--------|-------|-------------|
| Overview | `/admin` | Platform stats |
| Approvals | `/admin/approvals` | Approve / reject / request changes on events |
| All events | `/admin/events` | Full catalog; create events (auto-published) |
| Organizations | `/admin/organizations` | Manage orgs, commission overrides |
| Passports (RFID) | `/admin/rfid` | Program NFC cards, assign to users |
| Categories | `/admin/categories` | Event genres |
| Venues | `/admin/venues` | Global venue catalog (admin CRUD) |
| Alerts | `/admin/alerts` | Sales threshold alerts |
| Audit log | `/admin/audit` | Platform audit trail |
| Settings | `/admin/settings` | Default commission, staff fees |

### Unique to Super Admin

- Auto-approve & publish events on create
- Set per-event or per-org commission
- Program Entertain Passport RFID cards
- Full audit visibility
- Access all gate/organizer functions without org membership

---

## 8. Permission matrix (summary)

| Action | Customer | Organizer | Gate Staff | Super Admin |
|--------|:--------:|:---------:|:----------:|:-----------:|
| Buy tickets | ✓ | — | — | — |
| Publish events (via review) | — | ✓ | — | ✓ (instant) |
| Publish Places to Go | — | ✓ (Business Owner) | — | — |
| Approve events | — | — | — | ✓ |
| Program RFID cards | — | — | — | ✓ |
| Gate check-in | — | ✓* | ✓* | ✓ |
| Roll back check-in | — | ✓* | —** | ✓ |
| Manage gate staff team | — | ✓ | — | — |

\* When assigned as event staff or org admin  
\** Gate staff scanners cannot roll back; Event Managers can

---

## 9. Login routing (wrong-door protection)

| Attempt | Result |
|---------|--------|
| Customer at `/login` | ✓ |
| Organizer at `/organizer/login` | ✓ |
| Gate staff at `/organizer/login` | ✓ → `/gate` |
| Super Admin at `/third-eye/999/login` | ✓ |
| Customer at organizer login | Rejected, directed to `/login` |
| Organizer at customer login | Rejected, directed to `/organizer/login` |
| Super Admin at customer login | Rejected, directed to admin login |

---

## 10. Key URLs quick reference

```
Public:     /  /events  /genres  /venues  /checkout
Customer:   /login  /account/tickets  /account/profile
Organizer:  /organizer/login  /portal  /portal/venue  /portal/team
Gate:       /gate  /gate/[eventId]
Admin:      /third-eye/999/login  /admin
Auth:       /auth/callback  /auth/complete
```

---

## 11. Related docs

- `docs/QA_MANUAL_TEST_GUIDE.md` — **manual QA handover** (step-by-step for testers new to the platform)
- `docs/VERCEL_DEPLOY.md` — **initial Vercel deploy** (GitHub CD, env vars, Supabase Auth)
- `docs/SUPABASE.md` — database, seeding, connection
- `docs/ARCHITECTURE.md` — system architecture
- `.env.example` — required environment variables
