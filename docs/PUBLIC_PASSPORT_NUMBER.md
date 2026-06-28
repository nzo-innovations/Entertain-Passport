# Entertain Passport - Public Number Format

Platform: **Entertain Passport** by nZO Innovations  
Implementation: `src/lib/passport/passport-number-generator.ts`

---

## 1. Purpose

Every physical Entertain Passport card carries a **public passport number** - a customer-facing identifier printed on the card. It is used for:

- Card inventory and print batches
- Admin assignment to a member
- Display on the physical card and in the member account
- Cross-check during NFC programming and gate verification (together with the internal UUID and NFC signature)

The public number is **not** a payment instrument. It must **never** be used for payment processing, card-not-present transactions, or treated as a bank or credit card number.

---

## 2. Format overview

The public passport number is **16 numeric digits**, grouped for display in **four blocks of four**:

```
88YY TTRR RRRR XXXC
```

| Display group | Digits | Field | Description |
|---------------|--------|-------|-------------|
| 1 | 2 | **88** | Fixed Entertain Passport prefix |
| 1 | 2 | **YY** | Issue year (last two digits, e.g. `26` = 2026) |
| 2 | 2 | **TT** | Card type code |
| 2 | 2 | **RR** | Random (secure random digits) |
| 3 | 4 | **RRRR** | Random |
| 4 | 3 | **XXX** | Random |
| 4 | 1 | **C** | Luhn check digit |

**Example (Standard card, issued 2026):**

```
8826 1101 4837 2914
```

**Compact storage (database, APIs, NFC payload):**

```
8826110148372914
```

**Display storage (`formattedPassportNumber`):**

```
8826 1101 4837 2914
```

---

## 3. Segment reference

### 3.1 Prefix - `88`

All Entertain Passport public numbers start with **`88`**. This distinguishes them from other numeric identifiers and supports quick validation at data entry.

Validation rule: `publicPassportNumber.startsWith("88")`

### 3.2 Issue year - `YY`

Two-digit year when the number was issued in a batch.

| YY | Meaning |
|----|---------|
| `24` | 2024 |
| `25` | 2025 |
| `26` | 2026 |

Parsed from compact form: digits at positions 3–4 (0-based index `2:4`).

### 3.3 Card type - `TT`

Two-digit product tier, set when the batch is generated.

| TT | Label | Use case |
|----|-------|----------|
| `11` | Standard | Default member passport |
| `21` | VIP | Premium tier |
| `31` | Platinum | Top tier |
| `41` | Artist | Artist / performer cards |
| `51` | Staff | Internal / event staff |
| `61` | Partner | B2B / partner access |

Parsed from compact form: digits at positions 5–6 (0-based index `4:6`).

Constants: `src/lib/passport/types.ts` → `PASSPORT_CARD_TYPES`

### 3.4 Random body - `RR` + `RRRR` + `XXX`

Nine cryptographically random decimal digits (`crypto.randomInt`), assigned at generation time. Together with prefix, year, and type they make each number unique within the platform.

### 3.5 Check digit - `C`

The 16th digit is a **Luhn (mod 10) check digit** computed from the first 15 digits.

- Detects single-digit typos and many transposition errors at scan/entry
- Does **not** provide security against forgery - authentication uses the internal UUID, NFC UID, and HMAC signature

Implementation: `computeLuhnCheckDigit()` and `validateLuhnCheckDigit()` in `passport-number-generator.ts`

---

## 4. Internal identifier (not printed as the public number)

Each inventory record also receives a **UUID v4** (`internalPassportUuid`) at generation time. This is the primary backend identity token.

| Identifier | Role |
|------------|------|
| **Public passport number** | Printed on card; human-readable; inventory lookup |
| **Internal UUID** | NFC programming, HMAC signing, gate verification, database joins |

The public number alone **cannot** authenticate a user at the gate. Verification requires:

1. Valid NFC payload (internal UUID + public number + NFC UID + signature)
2. Card status `PROGRAMMED`
3. Valid ticket for the event (checked server-side)

---

## 5. Validation rules

When accepting a public number (admin assign, program, or API input):

| Rule | Error if failed |
|------|-----------------|
| Exactly 16 digits after stripping spaces/dashes | *Passport number must be 16 digits.* |
| Starts with `88` | *Passport number must start with 88.* |
| Luhn check digit valid | *Invalid check digit.* |
| Unique in `PassportNumberInventory` | *Duplicate* (at generation time) |

Helper: `validatePublicPassportNumber(value)` → `{ ok, compact, formatted, error? }`

Input normalization: `compactPublicNumber()` removes all non-digit characters, so `8826 1101 4837 2914` and `8826110148372914` are equivalent.

---

## 6. Inventory lifecycle

Public numbers move through statuses in `PassportNumberInventory`:

| Status | Meaning |
|--------|---------|
| `GENERATED` | Created in a batch; not yet released for assignment |
| `PRINTED` | Sent to print (optional intermediate step) |
| `AVAILABLE` | In backlog; ready to assign to a member |
| `ASSIGNED` | Linked to a user + hashed primary ID; ready for NFC programming |
| `PROGRAMMED` | NFC chip written; active for gate tap |
| `BLOCKED` | Temporarily declined |
| `DAMAGED` | Physically unusable |
| `REPLACED` | Superseded by a replacement card |

**Assignment rule:** only `AVAILABLE` → `ASSIGNED`  
**Programming rule:** only `ASSIGNED` → `PROGRAMMED`  
**Gate rule:** only `PROGRAMMED` cards pass NFC verification

---

## 7. Bulk generation flow

Super Admin: **`/admin/passports`** or `POST /api/passport/batches/generate`

1. Select card type (`TT`), issue year (`YY`), quantity, and batch code
2. System generates unique 16-digit numbers with UUID v4 per row
3. Records stored in `PassportNumberInventory` (status `GENERATED` or `AVAILABLE`)
4. Export CSV for card printer: `POST /api/passport/export-print-batch`

CSV columns include:

- `formattedPassportNumber`
- `publicPassportNumber`
- `cardType`
- `batchCode`
- `internalPassportUuid` (for internal print-house systems if needed - not for customer-facing print)

---

## 8. Assignment and NFC (summary)

After printing:

1. **Assign** - Admin enters public number + member email + primary ID (NIC or Passport). ID is **hashed** before storage; plain ID is never logged.
2. **Program NFC** - Admin reads blank chip UID, system builds signed payload using internal UUID + public number + NFC UID + hashed ID (in signature only, not on chip).
3. **Gate** - Reader sends NFC JSON to `POST /api/nfc/verify`; backend validates signature, status, and ticket.

See also: `docs/VERIFICATION_RUNBOOK.md`, admin pages `/admin/passports` and `/admin/nfc`.

---

## 9. NFC tag payload (v2)

Safe fields written to the NFC chip (no plain NIC/passport):

```json
{
  "internalPassportUuid": "4a1b6b45-dd9a-4fc7-a714-574e4915aa58",
  "publicPassportNumber": "8826110148372914",
  "nfcUid": "04A1B2C3D4E5F6",
  "keyVersion": 1,
  "issuedAt": "2026-06-16T12:00:00.000Z",
  "counter": 0,
  "signature": "<hex-hmac-sha256>"
}
```

HMAC payload (server-side only, includes hashed primary ID):

```
internalPassportUuid|publicPassportNumber|nfcUid|keyVersion|issuedAt|counter|userPrimaryIdHash
```

---

## 10. API quick reference

| Endpoint | Purpose |
|----------|---------|
| `POST /api/passport/batches/generate` | Bulk-generate numbers |
| `GET /api/passport/inventory` | List / search inventory |
| `POST /api/passport/assign` | Assign AVAILABLE number to user |
| `POST /api/nfc/program` | Program ASSIGNED card |
| `POST /api/nfc/verify` | Gate verification |
| `POST /api/passport/export-print-batch` | CSV export for printing |

---

## 11. Printing guidelines

- Print the **formatted** number in four groups: `8826 1101 4837 2914`
- Label clearly as **Entertain Passport** - not a payment card
- Do not print internal UUID on the customer-facing side unless required for a separate QR encoding workflow
- Optional QR may encode the formatted public number or an app deep-link - never encode plain NIC/passport or payment data

---

## 12. Related code

| File | Responsibility |
|------|----------------|
| `src/lib/passport/passport-number-generator.ts` | Generate, format, validate Luhn |
| `src/lib/passport/types.ts` | Card type codes, status constants |
| `src/lib/passport/passport-inventory-service.ts` | Batches, inventory, export |
| `src/lib/passport/passport-assignment-service.ts` | User assignment |
| `src/lib/passport/nfc-programming-service.ts` | NFC program + RfidCard sync |
| `prisma/schema.prisma` | `PassportBatch`, `PassportNumberInventory`, `NfcCardProgramming` |
