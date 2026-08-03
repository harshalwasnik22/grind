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

## 3. Configure magic-link auth

Grind signs in with a passwordless **magic link**. In the dashboard:

1. **Authentication → URL Configuration**: set **Site URL** to your app origin
   (e.g. `http://localhost:3000`) and add it to **Redirect URLs**.
2. **Authentication → Email Templates → Magic Link**: point the link at the
   app's confirm route so the session is exchanged server-side:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/">
     Log in to GRIND
   </a>
   ```

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
