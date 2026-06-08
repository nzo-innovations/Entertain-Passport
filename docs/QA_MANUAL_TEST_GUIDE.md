# Entertain Passport — Manual QA Test Guide

**Product:** Entertain Passport (ticketing platform by nZO Innovations)  
**Audience:** QA engineers, testers, and stakeholders who are **new to this system**  
**Last updated:** June 2026

Use this document to test the platform end-to-end without prior product knowledge. Each section explains **what** a feature is, **why** it exists, and **how** to verify it works.

---

## Table of contents

1. [What you are testing](#1-what-you-are-testing)
2. [Glossary](#2-glossary)
3. [Before you start (environment setup)](#3-before-you-start-environment-setup)
4. [Test accounts & passwords](#4-test-accounts--passwords)
5. [Quick smoke test (30 minutes)](#5-quick-smoke-test-30-minutes)
6. [URL map](#6-url-map)
7. [Test suites by role](#7-test-suites-by-role)
8. [Module test cases](#8-module-test-cases)
9. [End-to-end scenarios](#9-end-to-end-scenarios)
10. [Security & access control tests](#10-security--access-control-tests)
11. [Known limitations & out of scope](#11-known-limitations--out-of-scope)
12. [How to report bugs](#12-how-to-report-bugs)
13. [Regression checklist (release sign-off)](#13-regression-checklist-release-sign-off)

---

## 1. What you are testing

Entertain Passport is an event ticketing platform with four main user types:

| User type | Real-world person | Main job on the platform |
|-----------|-------------------|---------------------------|
| **Customer** | Ticket buyer | Browse shows, pay, keep tickets in a digital wallet |
| **Creator** | Event organizer, artist manager, artist, or venue owner | Create events, manage team, publish venues (venue owners) |
| **Gate staff** | Door scanner at an event | Check in attendees with QR/barcode or RFID passport |
| **Super Admin** | Platform owner (nZO) | Approve events, manage orgs, gate staff, RFID cards, settings |

**Core business flow:**

```
Creator submits event → Super Admin approves → Event appears on public site
→ Customer buys ticket → Ticket issued with QR code
→ Gate staff scans ticket at door → Ticket marked CHECKED_IN
```

**Secondary flow (Places to Go):**

```
Venue owner publishes pub/club profile → Public can browse /venues
→ Weekly live music program shown → Ticketed shows linked to same venue
```

---

## 2. Glossary

| Term | Meaning |
|------|---------|
| **Auth door** | Separate login page per role (customer vs organizer vs admin). Wrong role at wrong door is rejected. |
| **Portal** | Organizer/creator dashboard at `/portal` |
| **Gate console** | Check-in app at `/gate` |
| **Approval** | Super Admin must approve events before they appear publicly (except admin-created events) |
| **Organization (org)** | A company/brand under which events are published (e.g. "BeatPulse Events") |
| **Creator role lane** | Distinct `User.role`: `ORGANIZER`, `ARTIST_MANAGER`, `ARTIST`, `BUSINESS_OWNER` |
| **Gate staff** | `User.role = GATE_STAFF`; can only check in tickets for assigned events |
| **Entertain Passport** | NFC/RFID card that can be linked to a ticket for tap check-in |
| **Places to Go** | Public directory of pubs, cafés, clubs (`/venues`) |
| **Mock payment** | Checkout currently marks orders PAID immediately (WebXPay integration pending) |

---

## 3. Before you start (environment setup)

### 3.1 Prerequisites

- Node.js 18+ installed
- Git clone: `https://github.com/nZO-Innovations/Entertain-Passport`
- Branch: `main`
- A `.env` file copied from `.env.example` with valid Supabase credentials
- **Required for gate-staff account creation:** `SUPABASE_SERVICE_ROLE_KEY` in `.env`

### 3.2 Install & run

```bash
npm install
npm run dev
```

Open **http://localhost:3000**

| Command | When to use |
|---------|-------------|
| `npm run dev` | Daily QA — clears stale cache automatically |
| `npm run build && npm start` | Production-like local test |
| `npm run start:fresh` | Rebuild + start (after pulling new code) |

### 3.3 Browser tips

- Use **Chrome or Edge** (latest)
- If the UI looks unstyled (plain black/white, broken layout): **hard refresh** `Ctrl + Shift + R`
- If you see `ChunkLoadError` in console: hard refresh once; page should auto-reload
- Use **separate browser profiles** (or incognito windows) when testing different roles at the same time
- Gate staff: use **one browser window only** (session is per-window)

### 3.4 QA data reset (optional)

Seeded data lives in Supabase. To align legacy creator roles with org types, run once in Supabase SQL editor:

`scripts/backfill-creator-roles.sql`

---

## 4. Test accounts & passwords

**All seeded accounts use password:** `Password123!`

| Email | Role | Org type (if creator) | Login URL | After login lands on |
|-------|------|------------------------|-----------|----------------------|
| `demo@customer.test` | Customer | — | `/login` | `/account/tickets` |
| `promoter@beatpulse.test` | Event Organizer | ORGANIZER | `/organizer/login` | `/portal` |
| `artist@mayaray.test` | Artist Manager | ARTIST_MANAGER | `/organizer/login` | `/portal` |
| `venue@lumina.test` | Business Owner | BUSINESS_OWNER | `/organizer/login` | `/portal` (+ My Venue nav) |
| `scanner@door.test` | See note below | WORKER member | `/organizer/login` | `/gate` or `/portal` |
| `superadmin@nzo.test` | Super Admin | — | `/third-eye/999/login` | `/admin` |

**Note on `scanner@door.test`:** Seed data may show an older role. For gate testing, prefer creating a fresh gate-staff account via **Portal → Team** or **Admin → Gate staff**.

### Creating your own test users

| Role | Where to sign up | What to pick |
|------|------------------|--------------|
| Customer | `/login` → Create account | — |
| Event Organizer | `/organizer/login` → Create account | "Event Organizer" |
| Artist Manager | `/organizer/login` → Create account | "Artist Manager" |
| Artist | `/organizer/login` → Create account | "Artist (self-managed)" |
| Venue owner | `/organizer/login` → Create account | "Company / Venue Owner" |

After creator signup, the organization is created automatically on first portal visit.

---

## 5. Quick smoke test (30 minutes)

Run this first to confirm the build is usable.

| # | Step | Expected |
|---|------|----------|
| S1 | Open `/` | Home loads with styled UI, featured/upcoming events |
| S2 | Open `/events` | Event list loads, filters work |
| S3 | Sign in as `demo@customer.test` at `/login` | Lands on `/account/tickets` |
| S4 | Sign out, sign in as `promoter@beatpulse.test` at `/organizer/login` | Lands on `/portal`, sidebar shows "Event Organizer" |
| S5 | Sign in as `superadmin@nzo.test` at `/third-eye/999/login` | Lands on `/admin` |
| S6 | Admin → **Approvals** | Pending events list loads (may be empty) |
| S7 | Admin → **Gate staff** | Table loads; can see org/event columns |
| S8 | Customer: add ticket to cart from any published event → `/checkout` | Checkout page loads |
| S9 | Complete checkout (mock payment) | Order succeeds; ticket appears in My Tickets |
| S10 | Sign in as gate staff (created in Team or Admin) → `/gate` | Assigned events listed |

**Smoke pass criteria:** All 10 steps complete without crash, blank page, or unstyled UI.

---

## 6. URL map

### Public (no login)

| Page | URL |
|------|-----|
| Discover home | `/` |
| All shows | `/events` |
| Show detail | `/events/[slug]` |
| Genres | `/genres` |
| Places to Go | `/venues` |
| Place detail | `/venues/[slug]` |
| Checkout | `/checkout` |
| Promoters landing | `/promoters` |

### Customer

| Page | URL |
|------|-----|
| Login / sign up | `/login` |
| My tickets | `/account/tickets` |
| Profile | `/account/profile` |

### Creator portal

| Page | URL |
|------|-----|
| Login / sign up | `/organizer/login` |
| Dashboard | `/portal` |
| My events | `/portal/events` |
| Create event | `/portal/events/new` |
| Event detail | `/portal/events/[id]` |
| Edit event | `/portal/events/[id]/edit` |
| Event scanner | `/portal/events/[id]/scan` |
| Team (gate staff) | `/portal/team` |
| My Venue (business owner only) | `/portal/venue` |

### Gate

| Page | URL |
|------|-----|
| Event list | `/gate` |
| Check-in console | `/gate/[eventId]` |

### Super Admin

| Page | URL |
|------|-----|
| Login | `/third-eye/999/login` |
| Overview | `/admin` |
| Approvals | `/admin/approvals` |
| All events | `/admin/events` |
| Organizations | `/admin/organizations` |
| **Gate staff** | `/admin/gate-staff` |
| Passports (RFID) | `/admin/rfid` |
| Categories | `/admin/categories` |
| Venues | `/admin/venues` |
| Alerts | `/admin/alerts` |
| Audit log | `/admin/audit` |
| Settings | `/admin/settings` |

---

## 7. Test suites by role

Assign suites to testers or run in order A → F.

| Suite | Role | Focus |
|-------|------|-------|
| **A** | Public / anonymous | Browse, search, cart, no auth |
| **B** | Customer | Login, buy, tickets, profile, loyalty |
| **C** | Event Organizer | Events, wizard, submit, team |
| **D** | Business Owner | My Venue + events |
| **E** | Gate staff | Check-in, search, permissions |
| **F** | Super Admin | Approvals, orgs, gate staff, RFID, settings |

---

## 8. Module test cases

**How to use:** For each case, mark **Pass / Fail / Blocked / N/A** and note the bug ID if failed.

---

### 8.1 Public site & discovery (Suite A)

| ID | Test case | Steps | Expected result |
|----|-----------|-------|-----------------|
| PUB-01 | Home page | Open `/` | Hero, navigation, event cards render; dark theme default OK |
| PUB-02 | Event listing | Open `/events` | Only **published + approved** events shown |
| PUB-03 | Event search/filter | Use category/search on `/events` | Results update correctly |
| PUB-04 | Event detail | Open any event slug | Title, date, venue, packages, images, Add to cart |
| PUB-05 | Genres page | Open `/genres` | Categories listed, links work |
| PUB-06 | Places to Go | Open `/venues` | Published venues only |
| PUB-07 | Venue detail | Open a venue slug | Cover, program, linked ticketed events |
| PUB-08 | Theme toggle | Toggle light/dark on public page | Theme persists on navigation |
| PUB-09 | Mobile nav | Resize to mobile width | Hamburger menu opens, links work |
| PUB-10 | Draft event hidden | Find a draft event slug (via admin/portal) | Public URL returns 404 or not listed |

---

### 8.2 Customer — auth & account (Suite B)

| ID | Test case | Steps | Expected result |
|----|-----------|-------|-----------------|
| CUS-01 | Customer login | `/login` → `demo@customer.test` | Redirect to `/account/tickets` |
| CUS-02 | Customer signup | Create new account at `/login` | Account created; lands on profile or tickets |
| CUS-03 | Wrong door — organizer at customer login | Sign in as `promoter@beatpulse.test` at `/login` | Error: use organizer login |
| CUS-04 | Wrong door — admin at customer login | Sign in as `superadmin@nzo.test` at `/login` | Error: use admin login |
| CUS-05 | My tickets | `/account/tickets` | Purchased tickets with QR/barcode |
| CUS-06 | Profile — save | `/account/profile` → fill name, address | Saves without error |
| CUS-07 | Profile — loyalty fields | Add NIC/passport, birthday, gender | Profile completeness indicator updates |
| CUS-08 | Sign out | Click logout | Session cleared; protected routes redirect to login |
| CUS-09 | Session persistence | Login → close tab → reopen same browser | Still signed in (within 7 days) |

---

### 8.3 Customer — purchase flow (Suite B)

| ID | Test case | Steps | Expected result |
|----|-----------|-------|-----------------|
| BUY-01 | Add to cart | Event detail → select package → Add | Cart drawer shows item |
| BUY-02 | Cart quantity | Increase/decrease qty in cart | Totals update |
| BUY-03 | Checkout unsigned | Go to `/checkout` without login | Redirect to login with return URL |
| BUY-04 | Checkout signed in | Complete checkout with card option | Order PAID; tickets issued |
| BUY-05 | Ticket in wallet | After purchase → My Tickets | New ticket visible with VALID status |
| BUY-06 | Sold out handling | Buy until package qty exhausted | Clear error; no oversell |
| BUY-07 | KOKO payment | Select KOKO at checkout | Shown as unavailable / coming soon |
| BUY-08 | Assign ticket | Assign ticket to friend (NIC or passport no.) | Assignment saved |
| BUY-09 | Loyalty points | Complete purchase with complete profile | Points increase (1 pt per LKR 100) |

---

### 8.4 Creator — login & portal (Suite C/D)

| ID | Test case | Steps | Expected result |
|----|-----------|-------|-----------------|
| CRE-01 | Organizer login | `/organizer/login` → `promoter@beatpulse.test` | Portal opens; role label "Event Organizer" |
| CRE-02 | Artist Manager login | `artist@mayaray.test` | Portal; role label "Artist Manager" |
| CRE-03 | Business Owner login | `venue@lumina.test` | Portal; **My Venue** in sidebar |
| CRE-04 | Artist signup lane | Sign up as Artist | `User.role = ARTIST`; portal access |
| CRE-05 | Wrong door — customer at organizer login | `demo@customer.test` at `/organizer/login` | Rejected; directed to customer login |
| CRE-06 | Portal dashboard | `/portal` | Stats/cards load without error |
| CRE-07 | My events list | `/portal/events` | Org's events listed with status badges |
| CRE-08 | Gate staff blocked from portal | Login as pure GATE_STAFF | Redirect to `/gate`, not portal |

---

### 8.5 Creator — event wizard & lifecycle (Suite C)

| ID | Test case | Steps | Expected result |
|----|-----------|-------|-----------------|
| EVT-01 | Create event wizard | `/portal/events/new` → complete all steps | Event created as DRAFT / PENDING_REVIEW |
| EVT-02 | Image upload — valid | Upload JPEG ≥800×600 in wizard | Image accepted, preview shown |
| EVT-03 | Image upload — too small | Upload tiny image | Clear validation error |
| EVT-04 | Image upload — wrong type | Upload PDF | Rejected with message |
| EVT-05 | Ticket packages | Add 2+ packages with prices | Saved on event |
| EVT-06 | Submit for review | Submit from event detail | Status → PENDING_REVIEW |
| EVT-07 | Edit after changes requested | Admin requests changes → organizer edits | Can resubmit |
| EVT-08 | Event not public until approved | Before approval, check `/events` | Event not listed |
| EVT-09 | After approval | Admin approves → check public site | Event visible |
| EVT-10 | Assign artist tag | Add performing artist org on event | Artist org linked |
| EVT-11 | Event staff on event | Add scanner from team on event page | Staff appears on event |
| EVT-12 | Portal scanner | `/portal/events/[id]/scan` | Manual/QR check-in works for permitted user |
| EVT-13 | Commission read-only | View commission in wizard | Shows platform %; organizer cannot edit |

---

### 8.6 Creator — team & gate staff (Suite C)

| ID | Test case | Steps | Expected result |
|----|-----------|-------|-----------------|
| TEA-01 | Open team page | `/portal/team` | Gate staff list for org |
| TEA-02 | Add gate staff | Name, email, password → Add | Account created; appears in list |
| TEA-03 | Add without service key | Remove `SUPABASE_SERVICE_ROLE_KEY`, retry | Clear error message |
| TEA-04 | Reset password | Reset password on staff row | Success toast |
| TEA-05 | Delete gate staff | Delete staff member | Removed from org and system |
| TEA-06 | Assign to event | Pick event from dropdown → Assign | Badge shows on staff row |
| TEA-07 | Unassign from event | Click X on event badge | Assignment removed |
| TEA-08 | Gate staff login | New staff signs in at `/organizer/login` | Lands on `/gate` |
| TEA-09 | Staff sees only assigned events | Gate login → `/gate` | Only assigned events listed |

---

### 8.7 Business Owner — Places to Go (Suite D)

| ID | Test case | Steps | Expected result |
|----|-----------|-------|-----------------|
| VEN-01 | My Venue nav visible | Login as `venue@lumina.test` | "My Venue" in sidebar |
| VEN-02 | My Venue hidden for organizer | Login as `promoter@beatpulse.test` | No "My Venue" link |
| VEN-03 | Save venue profile | `/portal/venue` → fill name, kind, address | Saves successfully |
| VEN-04 | Cover image upload | Upload valid cover (≥1200×675, landscape) | Image stored and displayed |
| VEN-05 | Weekly program | Add weekly live music slot | Shows on program list |
| VEN-06 | One-off program | Add one-off program with date | Saved correctly |
| VEN-07 | Publish venue | Enable publish flag | Venue appears on `/venues` |
| VEN-08 | Public venue page | Open `/venues/[slug]` | Cover, program, events at venue |

---

### 8.8 Gate staff console (Suite E)

| ID | Test case | Steps | Expected result |
|----|-----------|-------|-----------------|
| GATE-01 | Gate home | Login as gate staff → `/gate` | Assigned events only |
| GATE-02 | Open check-in | Click event → `/gate/[eventId]` | Console loads |
| GATE-03 | Scan valid ticket | Enter barcode/scan QR of VALID ticket | CHECKED_IN; success feedback |
| GATE-04 | Scan again (duplicate) | Scan same ticket twice | Already checked-in message |
| GATE-05 | Invalid code | Enter random code | Not found error |
| GATE-06 | Search attendees | Search by name/email | Results paginate |
| GATE-07 | Filter checked-in | Toggle filters | List updates |
| GATE-08 | Rollback denied | As SCANNER role, try rollback | Denied (Event Manager only) |
| GATE-09 | New window session | Open `/gate` in new browser window while logged in | Must sign in again (gate session rule) |
| GATE-10 | Super Admin oversight | Admin opens `/gate/[eventId]` | Can access for testing |

---

### 8.9 Super Admin (Suite F)

| ID | Test case | Steps | Expected result |
|----|-----------|-------|-----------------|
| ADM-01 | Admin login | `/third-eye/999/login` → `superadmin@nzo.test` | Admin dashboard |
| ADM-02 | Wrong door | Admin at `/login` | Rejected |
| ADM-03 | Overview stats | `/admin` | Charts/cards load |
| ADM-04 | Approve event | Approvals → Approve pending event | Event PUBLISHED + APPROVED |
| ADM-05 | Reject event | Reject with note | Organizer sees rejection |
| ADM-06 | Request changes | Request changes with note | Organizer can edit & resubmit |
| ADM-07 | Create event as admin | `/admin/events/new` | Auto-published (no approval wait) |
| ADM-08 | Organizations list | `/admin/organizations` | All orgs with owner info |
| ADM-09 | Org commission override | Org detail → set commission % | Saved; shown on org |
| ADM-10 | Gate staff — list | `/admin/gate-staff` | All gate staff, orgs, events visible |
| ADM-11 | Gate staff — create | Pick org, add staff | Staff created under that org |
| ADM-12 | Gate staff — edit name | Edit name on staff row | Updated |
| ADM-13 | Gate staff — reset password | Reset password | Success |
| ADM-14 | Gate staff — assign event | Assign staff to any event | Assignment visible |
| ADM-15 | Gate staff — delete | Delete staff | Removed platform-wide |
| ADM-16 | RFID program card | `/admin/rfid` → add UID | Card created UNASSIGNED |
| ADM-17 | RFID assign to user | Assign card to customer email | Status ACTIVE |
| ADM-18 | Categories CRUD | Add/edit/delete category | Reflects on `/genres` and filters |
| ADM-19 | Venues CRUD | Admin venues add/edit | Saved in catalog |
| ADM-20 | Platform settings | Change default commission | New events use updated default |
| ADM-21 | Audit log | `/admin/audit` | Recent admin actions listed |
| ADM-22 | Sales alerts | `/admin/alerts` | Threshold alerts manageable |

---

### 8.10 Cross-cutting / UI stability

| ID | Test case | Steps | Expected result |
|----|-----------|-------|-----------------|
| X-01 | Hard refresh after deploy | Pull new code → `npm run dev` → hard refresh | Styled UI, no ChunkLoadError |
| X-02 | Admin nav — all links | Click every admin sidebar item | Each page loads |
| X-03 | Portal mobile nav | Mobile width in portal | Sheet menu works |
| X-04 | Logout from each role | Logout from customer, portal, admin, gate | Correct login page |
| X-05 | Protected route | Visit `/portal` unsigned | Redirect to organizer login |
| X-06 | 404 page | Visit `/does-not-exist` | Friendly not-found page |

---

## 9. End-to-end scenarios

These are **story-based** tests that cut across roles. Run after module tests pass.

### E2E-1: Publish and sell a show (full happy path)

| Step | Actor | Action |
|------|-------|--------|
| 1 | Event Organizer | Create event via wizard, upload image, add packages, submit |
| 2 | Super Admin | Approve event in Approvals |
| 3 | Customer | Find event on `/events`, add to cart, checkout |
| 4 | Customer | Confirm ticket in `/account/tickets` with QR |
| 5 | Organizer | Add gate staff in Team, assign to event |
| 6 | Gate staff | Login → `/gate` → open event → scan ticket |
| 7 | Customer | Refresh My Tickets | Status = CHECKED_IN |
| 8 | Super Admin | Check audit log | Create/approve/check-in actions logged |

**Pass:** Ticket sold, scanned once, status updated, no duplicate check-in allowed.

---

### E2E-2: Venue owner publishes a place

| Step | Actor | Action |
|------|-------|--------|
| 1 | Business Owner | `/portal/venue` → complete profile, upload cover |
| 2 | Business Owner | Add weekly program (e.g. Friday DJ night) |
| 3 | Business Owner | Publish venue |
| 4 | Anonymous | Browse `/venues`, open venue detail |
| 5 | Business Owner | Create ticketed event linked to same venue |
| 6 | Super Admin | Approve event |
| 7 | Anonymous | Venue page shows both program and ticketed event |

**Pass:** Venue and event both visible publicly.

---

### E2E-3: Super Admin manages gate staff for another org

| Step | Actor | Action |
|------|-------|--------|
| 1 | Super Admin | `/admin/gate-staff` → create staff under BeatPulse org |
| 2 | Super Admin | Assign staff to a BeatPulse event |
| 3 | Gate staff | Login → only that event visible |
| 4 | Gate staff | Check in a ticket for that event |
| 5 | Super Admin | Remove event assignment |
| 6 | Gate staff | Refresh `/gate` | Event no longer listed |

**Pass:** Admin can manage staff on behalf of organizers.

---

### E2E-4: Wrong-door and role isolation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Customer tries `/admin` | Redirect away |
| 2 | Organizer tries `/admin` | Redirect to portal |
| 3 | Gate staff tries `/portal` | Redirect to gate |
| 4 | Customer tries `/organizer/login` | Rejected at sign-in |

**Pass:** No role can access another role's console.

---

## 10. Security & access control tests

| ID | Test | Expected |
|----|------|----------|
| SEC-01 | Call `/api/admin/gate-staff` without login | 401/403 |
| SEC-02 | Customer session calls `/api/admin/settings` | 403 |
| SEC-03 | Gate staff calls `/api/events` POST (create event) | 403 |
| SEC-04 | Gate staff opens unassigned event `/gate/[eventId]` | Blocked or empty |
| SEC-05 | Organizer edits another org's event URL directly | 403 or not found |
| SEC-06 | Upload image without login | 401 |

---

## 11. Known limitations & out of scope

Document these as **expected behaviour**, not bugs (unless regression):

| Item | Status |
|------|--------|
| **WebXPay live payment** | Mocked — orders go PAID immediately |
| **KOKO pay-later** | UI only — "coming soon" |
| **Email confirmation** | May be disabled in dev; signup can auto-login |
| **RLS direct Supabase access** | App uses Prisma; anon key cannot read tables directly (by design) |
| **Gate staff multi-window** | Second window requires new login (by design) |
| **Production scale test** | Load/stress testing not covered here — see `docs/PERFORMANCE.md` |

---

## 12. How to report bugs

Use this template for each defect:

```
Bug ID:        QA-###
Title:         Short description
Environment:   local / staging / production
URL:           Full path
Role/account:  e.g. superadmin@nzo.test
Browser:       Chrome 125 / Edge 124

Steps to reproduce:
1.
2.
3.

Expected:
Actual:
Screenshot/console:
Severity:      Blocker / Major / Minor / Cosmetic
```

**Severity guide:**

| Level | Example |
|-------|---------|
| Blocker | Cannot login, checkout broken, data loss |
| Major | Feature unusable but workaround exists |
| Minor | Wrong label, layout glitch on one page |
| Cosmetic | Spacing, typo |

---

## 13. Regression checklist (release sign-off)

Before signing off a release, confirm:

- [ ] Smoke test (Section 5) — all pass
- [ ] E2E-1 Publish and sell — pass
- [ ] E2E-2 Venue publish — pass
- [ ] E2E-3 Admin gate staff — pass
- [ ] E2E-4 Role isolation — pass
- [ ] All four creator signup lanes create correct role
- [ ] Image upload works (event + venue)
- [ ] `npm run build` succeeds with zero errors
- [ ] No unstyled UI after hard refresh on login pages
- [ ] `.env` secrets not committed to git

**Sign-off:**

| Field | Value |
|-------|-------|
| Tester name | |
| Date | |
| Build / commit | |
| Environment | |
| Result | Pass / Fail |
| Notes | |

---

## Related documentation

| Document | Purpose |
|----------|---------|
| `docs/USER_CAPABILITIES.md` | Feature list by role |
| `docs/SUPABASE.md` | Database, seed accounts, auth flow |
| `docs/ARCHITECTURE.md` | System architecture |
| `docs/PERFORMANCE.md` | Performance & deployment |
| `.env.example` | Required environment variables |

---

*Questions about test data or Supabase access? Contact the development team or platform admin.*
