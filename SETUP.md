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
so there are no redirect-URL or link-expiry headaches). In the dashboard,
**Authentication → Emails → Templates → Magic Link**, make the email show the
code by including `{{ .Token }}`:

```html
<h2>Your GRIND code</h2>
<p>Enter this 6-digit code to sign in:</p>
<h1 style="letter-spacing:4px">{{ .Token }}</h1>
<p>It expires in 1 hour. If you didn't request it, ignore this email.</p>
```

Notes:

- Editing this template is available on the **free** tier
  (Authentication → Emails → Templates). Only custom SMTP / higher send-rates
  are paid.
- OTP needs **no** Site URL / Redirect URL configuration — nothing redirects.
- The old magic-link flow still works if you'd rather use a link: point the
  template at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/`
  (or keep the stock `{{ .ConfirmationURL }}` link — the confirm route handles
  the PKCE `?code=` callback too). Then Site URL + Redirect URLs must match your
  app origin.

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
