# Entertain Passport — Verification API (Design Document)

> **Status:** Decisions LOCKED (2026-06) — Phases 1–5 implemented. See §12 + §13.
> **Owner:** Super Admin / Platform team
> **Goal:** Turn the Entertain Passport NFC/RFID card into a secure, monetizable
> identity-verification *product* that third-party ticketing platforms can consume,
> without ever exposing our sales / events / orders / financial data, and without
> letting partners read the card without us.

---

## 1. Why this exists

Today the Entertain Passport card is an **internal** check-in token. A tapped card
UID or passport number is resolved to a `Ticket` for one event, behind a logged-in
session (see `findTicketByCode` in `src/lib/gate.ts`).

We want to expose **card validation as a paid B2B service**. Other ticketing /
event / venue platforms integrate their NFC readers with our API. When a user taps
their Entertain Passport card on a partner's reader, the partner calls our API to
confirm the card (and optionally the person) is genuine and active — and we charge
for it.

Four distinct problems this design solves:

1. **A public B2B verification API** for third parties.
2. **Card data encryption** so the chip's meaningful data can *only* be decrypted by
   us (forcing partners to use the paid API instead of reading cards themselves).
3. **Blast-radius isolation** so a breach of the public API cannot reach
   tickets / sales / events / financial data.
4. **Deep, Super-Admin-only monitoring** of the API service.

---

## 2. Current state (baseline)

| Area | Today |
|---|---|
| Stack | Next.js 14 (App Router) · Prisma · single Supabase Postgres · Supabase Auth |
| Roles | `SUPER_ADMIN` exists (`requireSuperAdmin` in `src/lib/auth.ts`) |
| Card model | `RfidCard`: `uid` (raw chip UID, **plaintext**), `passportNo` (**plaintext**), `status`, `assignedUserId` |
| Validation | Internal only; `findTicketByCode` matches `uid`/`passportNo` → `Ticket`, behind session + `canScanEventTickets` |
| Data | RFID, users, tickets, orders, sales, commissions, events all share **one** Postgres + **one** Prisma client |

Gaps for this product: no external API, no card encryption, no partner/tenant
concept, no metering, no isolation between *card identity* data and *revenue* data.

---

## 3. Target architecture — three isolated planes

```
┌─────────────────────────────────────────────────────────────┐
│  CORE PLANE (existing app)                                    │
│  events · orders · tickets · commissions · venues · users     │
│  Prisma `public` schema — full access, internal only          │
└───────────────┬───────────────────────────────────────────────┘
                │  one-way, write-only sync (no path back)
                ▼
┌─────────────────────────────────────────────────────────────┐
│  VERIFICATION PLANE (new, isolated)                           │
│  passport identities (minimal) · card keys · partners · usage │
│  `verification` schema — least-privilege role                 │
└───────────────┬───────────────────────────────────────────────┘
                │  signed, rate-limited, scoped
                ▼
┌─────────────────────────────────────────────────────────────┐
│  PARTNER EDGE   POST /api/v1/verify   (HMAC + API key)        │
└─────────────────────────────────────────────────────────────┘
```

**Key security property:** the process serving partner traffic connects to Postgres
with a DB role that *physically cannot* `SELECT` from `Order`, `Ticket`, `Event`,
etc. Even a full RCE on the API edge yields no sales data — it is not reachable by
that role.

---

## 4. Data isolation — the core decision

Options, weakest → strongest:

| Option | Isolation | Effort | Notes |
|---|---|---|---|
| Single DB + RLS + restricted role | Weak | Low | API still touches the same DB/tables |
| **Separate `verification` schema + least-privilege role** | **Strong** | **Medium** | **Recommended start** |
| Separate database / Supabase project + one-way sync | Strongest | High | Eventual hardening target |

**Recommended path:** start with a `verification` schema + dedicated role now, with a
clean sync boundary so we can later promote it to a fully separate Supabase project
with minimal rework.

### Mechanics (separate-schema approach)

1. Create a Postgres schema `verification` alongside `public`.
2. Create a DB role `ep_verify_api` with privileges **only** on `verification.*`
   (no `public.*` at all).
3. Partner-edge code uses a **second Prisma client** whose connection string uses
   `ep_verify_api`. The existing full-access `db` client is **never** imported into
   `/api/v1/*`.
4. A one-way sync (DB trigger or small internal job) projects minimal identity fields
   from `public` into `verification` on card assign / block / update.

---

## 5. New data model (verification plane)

All models below live in the `verification` schema. **PII is stored as salted hashes**
— identity match works by hashing partner input the same way and comparing.

```prisma
/// Minimal identity projection — the ONLY user data the API can read.
model VerifIdentity {
  id           String   @id @default(cuid())
  passportNo   String   @unique          // EP-XXXX-XXXX
  cardUidHash  String   @unique          // HMAC(uid); never store raw uid here
  status       String                    // ACTIVE | BLOCKED | LOST | UNASSIGNED
  nameHash     String?                   // salted hash, never plaintext
  nicHash      String?
  mobileHash   String?
  displayName  String?                   // optional, scope-gated readback
  syncedAt     DateTime @updatedAt
  @@schema("verification")
}

/// Per-card cryptographic material for the on-card encrypted block.
model VerifCardKey {
  id          String   @id @default(cuid())
  passportNo  String   @unique
  keyRef      String                      // ref into KMS / DESFire key diversification
  keyVersion  Int      @default(1)
  rotatedAt   DateTime @default(now())
  @@schema("verification")
}

/// A third-party platform that consumes the API.
model Partner {
  id           String      @id @default(cuid())
  name         String
  status       String      @default("ACTIVE")  // ACTIVE | SUSPENDED
  plan         String      @default("PAYG")     // pricing tier
  createdAt    DateTime    @default(now())
  apiClients   ApiClient[]
  @@schema("verification")
}

/// Issued credential. Secret stored hashed (argon2/bcrypt), shown once.
model ApiClient {
  id            String   @id @default(cuid())
  partnerId     String
  partner       Partner  @relation(fields: [partnerId], references: [id])
  keyId         String   @unique            // public identifier
  secretHash    String                      // hashed signing secret
  scopesJson    String                      // ["verify:tap","read:displayName"]
  ipAllowlist   String?                     // CIDRs
  rateLimitRpm  Int      @default(120)
  monthlyQuota  Int?
  status        String   @default("ACTIVE")
  createdAt     DateTime @default(now())
  revokedAt     DateTime?
  @@schema("verification")
}

/// Every API call — the Super-Admin monitoring backbone.
model ApiRequestLog {
  id           String   @id @default(cuid())
  apiClientId  String?
  endpoint     String
  mode         String   // TAP | IDENTITY
  verdict      String   // VALID | INVALID | NOT_FOUND | BLOCKED | DENIED
  httpStatus   Int
  latencyMs    Int
  ip           String?
  sigValid     Boolean
  reason       String?
  createdAt    DateTime @default(now())
  @@index([apiClientId, createdAt])
  @@index([verdict, createdAt])
  @@schema("verification")
}

/// Monthly usage rollups for billing.
model UsageCounter {
  id          String @id @default(cuid())
  apiClientId String
  period      String   // "2026-06"
  count       Int      @default(0)
  @@unique([apiClientId, period])
  @@schema("verification")
}
```

---

## 6. Card encryption design

Realities and approach:

- **UID is hardware and readable by any reader** — it cannot be hidden. We store only
  its **HMAC** (`cardUidHash`), never the raw UID, in the verification plane.
- **Encrypted data block** in the card's user memory holds `passportNo` + version +
  issue nonce, protected with **envelope encryption**: a per-card data key wrapped by
  a master key held in a KMS / secret store that *only our service* can unwrap.
  Partners reading the chip get ciphertext.
- **Replay protection:** the partner reader sends the block plus a fresh
  challenge/timestamp; we reject stale or replayed payloads.
- **Clone resistance (recommended for a paid security product):** use **MIFARE
  DESFire EV2/EV3** secure-element cards with AES mutual authentication and key
  diversification. With cheap UID-only cards (NTAG / MIFARE Classic) we can sign a
  token but **cannot** prevent UID cloning — acceptable only if every verification is
  backed by the server-side `status` + identity check.
- **Key management:** master keys in a KMS (Supabase has none — use a cloud KMS or an
  encrypted-secrets approach). Rotation supported via `keyVersion`.

---

## 7. Partner API contract (illustrative)

```http
POST /api/v1/verify
Authorization: EP-HMAC keyId="pk_live_123", ts=..., nonce=..., sig=...
Content-Type: application/json

{ "mode": "identity",
  "passportNo": "EP-7F3A-91C2",
  "name": "...", "nic": "...", "mobile": "..." }
```

```json
{ "valid": true,
  "passportNo": "EP-7F3A-91C2",
  "status": "ACTIVE",
  "identity": { "displayName": "..." },
  "verifiedAt": "2026-06-11T..." }
```

### Two validation modes

- **Mode A — Card tap:** partner reader sends card payload (UID + encrypted block /
  signed token) → we decrypt/verify → respond.
- **Mode B — Identity match:** partner sends `passportNo` + one or more of
  `{name, nic, mobile}` → we hash + match → respond `valid / not valid` + scoped
  identity fields.

Responses never include sales / financial data — only a verdict and the fields the
partner's scope permits.

### Edge pipeline (before any DB identity read)

```
TLS → API key lookup → IP allowlist → HMAC signature + timestamp/nonce
   → scope check → rate limit / quota → verify → log to ApiRequestLog → respond
```

---

## 8. Securing the API (defense in depth)

- Per-partner credentials (key ID + secret); never our Supabase keys.
- HMAC request signing (signature over body + timestamp + nonce) on top of TLS.
- IP allow-listing, scopes (field-level), rate limits + monthly quotas per client.
- Dedicated API edge route group with its own middleware; never imports the
  full-access Prisma client.

---

## 9. Super-Admin monitoring (only)

New `/admin/api` section gated by `requireSuperAdmin`:

- Live request feed; per-partner volume / latency / verdict charts (reuse `recharts`).
- Abuse / anomaly alerts: spikes in `INVALID` / `DENIED`, signature failures, quota
  breaches.
- Partner & key management: issue / revoke / rotate, set scopes / limits / IPs.
- Usage & billing rollups (`UsageCounter`).

No other role sees any of this surface.

---

## 10. Billing / metering

Track usage from day one via `ApiRequestLog` + `UsageCounter`, even if invoicing is
manual at first. Plans (`Partner.plan`): e.g. `PAYG`, tiered monthly quotas. Quota
breach → soft warn → hard block per `ApiClient.monthlyQuota`.

---

## 11. Phased roadmap

| Phase | Deliverable |
|---|---|
| **0 — Design lock** | This document; confirm isolation level, card hardware, scopes, pricing |
| **1 — Verification plane** | `verification` schema + least-privilege role + 2nd Prisma client + one-way identity sync |
| **2 — Partner & auth** | `Partner` / `ApiClient`, key issuance, HMAC signing, scopes, rate limits |
| **3 — Verify endpoint** | `/api/v1/verify` (both modes) + `ApiRequestLog` |
| **4 — Card crypto** | Envelope encryption / DESFire keying + rotation; update RFID programming flow |
| **5 — Monitoring + metering** | Super-Admin `/admin/api` dashboards + billing rollups |
| **6 — Hardening** | Pen-test pass; optional promotion of verification plane to a separate Supabase project |

---

## 12. Decisions — LOCKED (2026-06)

1. **Isolation level:** **SEPARATE DATABASE now.** The verification plane has its own
   Prisma schema (`prisma/verification/schema.prisma`), its own generated client
   (`src/generated/verify-client`, consumed via `@/lib/verify-db`), and its own
   connection (`VERIFY_DATABASE_URL` / `VERIFY_DIRECT_URL`). The runtime role must
   have NO privileges on the core `public` schema.
2. **Card hardware:** **DESFire EV2/EV3.** Per-card data key, envelope-wrapped by a KMS
   master key, with UID-bound diversification (`diversifierHash`) for clone resistance.
3. **Validation modes:** **TAP-ONLY.** `/api/v1/verify` accepts `{ mode: "tap", uid, block }`
   only; identity-match mode is intentionally not exposed.
4. **KMS:** pluggable provider (`VERIFY_KMS_PROVIDER`). `local` for dev (env master key);
   `aws-kms` / `vault` seams for production. Rotation via `keyVersion`; retired versions
   are retained so older cards still decrypt.
5. **Pricing:** per-partner, **Super-Admin controlled only.** Default `VerifPlan` tiers
   (PAYG/STARTER/PRO/ENTERPRISE) provide baseline unit price + quota + rate limit; any
   partner can be individually overridden (`Partner.override*`). Metered via
   `ApiRequestLog` + `UsageCounter`.
6. **Data-sharing / consent:** the API returns **validation status only** — no identity
   fields ever leave the plane. `PartnerConsent` records the accepted terms version,
   legal basis, and the exact shared-field set (`["validation_status"]`).

## 13. Implementation map (where the code lives)

| Concern | Location |
|---|---|
| Isolated schema / client | `prisma/verification/schema.prisma`, `src/generated/verify-client`, `src/lib/verify-db.ts` |
| KMS / envelope crypto | `src/lib/verify/kms.ts` |
| Hashing + on-card block | `src/lib/verify/crypto.ts` |
| Credential custody | `src/lib/verify/secret.ts` |
| HMAC signing | `src/lib/verify/hmac.ts` |
| Auth pipeline | `src/lib/verify/auth.ts` |
| Pricing/limit resolution | `src/lib/verify/limits.ts` |
| Tap verify + metering | `src/lib/verify/verify-core.ts` |
| One-way sync + provisioning | `src/lib/verify/sync.ts` (called from `src/app/api/admin/rfid/*`) |
| Partner edge | `src/app/api/v1/verify/route.ts` |
| Super-Admin APIs | `src/app/api/admin/verify/*` |
| Super-Admin UI | `src/app/admin/api/*`, `src/components/admin/verify-*` |

Setup + runbook: see `docs/VERIFICATION_RUNBOOK.md`.
