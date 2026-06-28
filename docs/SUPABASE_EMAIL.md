# Entertain Passport - Branded Auth Emails

Supabase sends signup and password-reset emails. By default they appear as **"Supabase Auth"** from `noreply@mail.app.supabase.io`. Customers should see **Entertain Passport** only - no third-party branding and no technical details.

Configure this in the **Supabase Dashboard** (not in app code).

---

## 1. Custom SMTP (recommended for production)

**Dashboard → Project Settings → Authentication → SMTP Settings**

| Field | Example |
|-------|---------|
| Enable custom SMTP | On |
| Sender email | `noreply@entertainpassport.lk` (or your verified domain) |
| Sender name | `Entertain Passport` |
| Host | Your provider (Resend, SendGrid, AWS SES, etc.) |
| Port | `587` (TLS) |

Use a domain you control (e.g. `entertainpassport.lk` or `mail.nzoinnovations.com`) with SPF, DKIM, and DMARC so messages land in the inbox, not spam.

---

## 2. Email templates

**Dashboard → Authentication → Email Templates**

Update **Confirm signup** (and optionally **Magic link**, **Reset password**).

### Subject

```
Confirm your Entertain Passport account
```

### Body (HTML)

```html
<h2>Welcome to Entertain Passport</h2>
<p>Hi there,</p>
<p>Thanks for signing up. Tap the button below to confirm your email and start discovering live events.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm my email</a></p>
<p>If you did not create an account, you can ignore this message.</p>
<p>- Entertain Passport<br/>Powered by nZO Innovations</p>
```

Supabase replaces `{{ .ConfirmationURL }}` with the verification link. That link goes to your app’s `/auth/callback`, which then sends the user to the **Discover** page.

---

## 3. Site URL & redirect allow list

**Dashboard → Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| Site URL | `https://your-production-domain.com` |
| Redirect URLs | `https://your-production-domain.com/auth/callback` |
| | `http://localhost:3000/auth/callback` (dev) |

The app sets signup `emailRedirectTo` to:

```
/auth/callback?next=/?verified=1
```

After confirmation, users land on **Discover** (`/`) with a welcome banner - not the My tickets page.

---

## 4. What users should never see

- "Supabase Auth" as sender name
- `@mail.app.supabase.io` in the From field (use custom SMTP)
- NFC chip UIDs or other internal technology names in emails

---

## 5. Local / staging testing

1. Enable custom SMTP or use Supabase’s built-in mail for dev only.
2. Sign up with a real inbox you control.
3. Confirm the **From** name is **Entertain Passport**.
4. Click the link → you should arrive on `/` with the onboarding banner.

---

## 6. Optional: Resend via Supabase

If you use [Resend](https://resend.com):

1. Verify domain `entertainpassport.lk` (or your domain).
2. Create API key.
3. In Supabase SMTP: host `smtp.resend.com`, user `resend`, password = API key, sender `Entertain Passport <noreply@yourdomain>`.

---

## Checklist

- [ ] Custom SMTP enabled with **Entertain Passport** sender name
- [ ] Confirm signup template updated (subject + body)
- [ ] Site URL and redirect URLs include `/auth/callback`
- [ ] Test signup end-to-end → Discover page + banner
