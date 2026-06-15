# Verification API — Operations Runbook

Companion to `docs/VERIFICATION_API.md`. Covers provisioning the isolated
verification plane, KMS, partner onboarding, the request-signing contract, and
key/identity rotation.

Decision lock: **separate DB · DESFire EV2/EV3 · tap-only · per-partner pricing
(Super-Admin) · verdict-only sharing.**

---

## 1. Environment

Set these in `.env` (and Vercel project settings for prod):

| Var | Purpose |
|---|---|
| `VERIFY_DATABASE_URL` | Pooled connection to the DEDICATED verification DB |
| `VERIFY_DIRECT_URL` | Direct connection (migrations) |
| `VERIFY_KMS_PROVIDER` | `local` (dev) / `aws-kms` / `vault` |
| `VERIFY_KMS_KEY_ID` | Master key reference, e.g. `ep-card-master` |
| `VERIFY_LOCAL_MASTER_KEY` | base64(32 bytes) AES-256 — dev only |
| `VERIFY_HASH_PEPPER` | server-side pepper for UID/PII hashes |
| `VERIFY_HMAC_MAX_SKEW_SECONDS` | replay window (default 120) |

Generate a dev master key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 2. Provision the plane

> ⚠️ **DESTRUCTIVE-IF-MISCONFIGURED.** `db:push:verify` runs `prisma db push`
> against `VERIFY_DATABASE_URL`. If that URL points at the **core** database, the
> push treats every core table (`User`, `Event`, `Order`, `Ticket`, …) as "not in
> the verification schema" and **drops them all**. This happened once in dev when
> `VERIFY_*` defaulted to the core Supabase project.
>
> **Mitigation now in place:** `db:push:verify` and `db:seed:verify` first run
> `npm run verify:guard` (`scripts/verify-db-guard.mjs`), which **refuses to
> proceed** if `VERIFY_DATABASE_URL`/`VERIFY_DIRECT_URL` resolve to the same
> project/host as `DATABASE_URL`/`DIRECT_URL`. Never bypass this guard.
>
> **If core tables are ever dropped:** recover row data from a Supabase backup /
> Point-in-Time Recovery (Dashboard → Database → Backups). Re-running
> `prisma db push` only recreates empty tables and does NOT restore RLS policies
> or data.

```bash
# 1. Point VERIFY_* at a DEDICATED database (separate Supabase project in prod).
#    It must hold NO sales/orders/events/financial data.
# 2. Confirm isolation, create schema + client, then seed pricing plans.
npm run verify:guard      # must print "OK — verification DB is distinct"
npm run db:generate:verify
npm run db:push:verify     # guarded
npm run db:seed:verify     # guarded
```

`postinstall` already generates BOTH clients, so Vercel builds work unchanged.

---

## 3. Least-privilege DB role (production isolation)

On the verification database, create a role that can ONLY touch the verification
tables. The app connects as this role via `VERIFY_DATABASE_URL`.

```sql
-- Run as an admin on the verification database.
CREATE ROLE ep_verify_api LOGIN PASSWORD 'CHANGE_ME';

-- No access to anything by default.
REVOKE ALL ON SCHEMA public FROM ep_verify_api;
GRANT USAGE ON SCHEMA public TO ep_verify_api;

-- Grant only on the verification tables (already created by db:push:verify).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ep_verify_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ep_verify_api;
```

Because this is a SEPARATE database, the role has no physical path to core
sales / orders / events data even under full compromise of the partner edge.

---

## 4. Partner onboarding (Super Admin → /admin/api/partners)

1. Onboard a partner; pick a plan (or override pricing later).
2. Record data-sharing consent (terms version + legal basis). Shared fields are
   fixed to `validation_status`.
3. Issue an API key — the **signing secret is shown once**. Share it securely.
4. Optionally set per-partner overrides (unit price, monthly quota, rate limit)
   and per-key IP allowlist / rate limit.

---

## 5. Partner request-signing contract

`POST /api/v1/verify` over TLS.

Header:

```
Authorization: EP-HMAC keyId="pk_live_..", ts="<unix-seconds>", nonce="<random>", sig="<hex>"
```

Canonical string the partner signs (newline-separated):

```
<ts>
<nonce>
POST
/api/v1/verify
<sha256(body) hex>
```

Signature = `HMAC_SHA256(secret, canonical)` as hex. Body:

```json
{ "mode": "tap", "uid": "<chip-uid>", "block": "<base64 on-card block>" }
```

Response (verdict-only):

```json
{ "valid": true, "status": "ACTIVE", "verifiedAt": "2026-06-12T..." }
```

Reference signer (Node):

```js
const crypto = require("crypto");
const ts = Math.floor(Date.now() / 1000).toString();
const nonce = crypto.randomBytes(12).toString("hex");
const body = JSON.stringify({ mode: "tap", uid, block });
const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
const canonical = [ts, nonce, "POST", "/api/v1/verify", bodyHash].join("\n");
const sig = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
```

Failure reasons returned in `reason`: `missing_or_malformed_auth`,
`unknown_or_revoked_key`, `partner_suspended`, `stale_timestamp`,
`ip_not_allowed`, `bad_signature`, `replayed_nonce`, `scope_denied`,
`rate_limited`, `quota_exceeded`.

---

## 6. Card lifecycle

- **Program (Super Admin RFID):** creating a card provisions a per-card data key
  and returns `cardBlock` (base64) — write this into the DESFire user memory.
- **Assign / block / lost:** mirrored to `VerifIdentity.status` via one-way sync.
- **Verify (tap):** edge unwraps the data key, decrypts the block, checks the
  passport + UID diversifier, and returns the status.

---

## 7. Rotation

- **Card key:** re-run provisioning for a passport (rotates `keyVersion`,
  re-wraps the data key, rewrites the card block). Older cards keep working
  because retired master-key versions are retained in the KMS.
- **Master key:** add a new version in the KMS, bump `VERIFY_KMS_KEY_VERSION`;
  new cards use it, old cards decrypt with their stored version.
- **Partner secret:** Rotate from the key row — new secret shown once.
- **Pepper:** rotating `VERIFY_HASH_PEPPER` invalidates all hashes; only do this
  with a full re-sync of identities. Treat as a key.

---

## 8. Billing

`UsageCounter` rolls up per key per month (`count`, `billableCount`,
`amountMinor`). Billable = a definitive answer about a real card (VALID/BLOCKED
or a tampered block). The included allowance grants the first N billable
verifications free each period; the unit price applies after. Quota breach →
hard block (`402 quota_exceeded`).
