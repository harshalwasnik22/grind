# GRIND — setup

## 1. Create a Supabase project

1. Sign up at <https://supabase.com> and create a new **free** project.
2. Wait for it to provision, then open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, keep secret)
3. Paste them into `.env.local` (copy from `.env.example`).

## 2. Apply the database schema

**Option A — SQL editor (no tooling, easiest).** In the Supabase dashboard open
**SQL Editor**, then run the files in `supabase/migrations/` **in order**
(`0001` → `0006`): paste each file's contents and click *Run*.

**Option B — Supabase CLI (needs Docker for local dev).**

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Verify the schema locally any time (no Docker, uses PGlite):

```bash
npm run db:verify
```

## 3. Configure passwordless (OTP code) auth

Grind signs in with a passwordless **6-digit email code** (OTP — no magic link,
so no redirect-URL or link-expiry headaches). Supabase's **built-in** email
service locks the templates to a magic-link-only default, so surfacing the code
requires **custom SMTP**. We use **Resend** (also powers the weekly recap).

**a. Resend** (<https://resend.com>, free tier = 3k emails/mo):

1. Create an account. To email anyone other than your own signup address you
   must **verify a sending domain** (Resend → Domains → add DNS records). Just
   testing yourself? You can send from `onboarding@resend.dev` to your own email.
2. Create an **API key** (`re_…`). Reuse it as `RESEND_API_KEY` for recaps too.

**b. Supabase → Authentication → Emails → SMTP Settings** — enable custom SMTP:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (`re_…`) |
| Sender email | a **verified** Resend address (e.g. `grind@yourdomain.com`) |
| Sender name | `GRIND` |

**c. Supabase → Authentication → Emails → Templates → Magic Link** — now
editable; make the email show the code by including `{{ .Token }}`:

```html
<h2>Your GRIND code</h2>
<p>Enter this 6-digit code to sign in:</p>
<h1 style="letter-spacing:4px">{{ .Token }}</h1>
<p>It expires in 1 hour. If you didn't request it, ignore this email.</p>
```

Notes:

- `signInWithOtp` uses the **Magic Link** template for both new and existing
  users, and `verifyOtp({ type: "email" })` checks the code. OTP needs **no**
  Site URL / Redirect URL configuration — nothing redirects.
- Magic-link fallback (if you skip SMTP): keep the stock `{{ .ConfirmationURL }}`
  email — `src/app/auth/confirm/route.ts` handles the PKCE `?code=` callback —
  and set Site URL + Redirect URLs to your app origin.

## 4. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Without Supabase env set, the app still renders the pixel UI; auth/DB features
switch on once the keys above are present.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server Supabase access (RLS-gated) |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron / admin server ops (bypasses RLS) — never expose |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push (Phase 9) |
| `RESEND_API_KEY` | Weekly recap email (Phase 9) |
| `CRON_SECRET` | Shared bearer secret protecting `/api/cron/*` |
