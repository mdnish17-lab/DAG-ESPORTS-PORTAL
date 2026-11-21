# DAG Esports — clean Supabase management-login project

This package was built from the original `DAG-ESPORTS-PORTAL-main.zip` you uploaded, **not** from the broken Google/PIN attempts. The original Admin, Roster, Evaluation, Planner, Team Performance, Home, styles and images are preserved. Admin now requires an approved Supabase Auth email + password. The Admin CRUD code continues using your existing browser Supabase client, but the cookie session and *database RLS policies* (SQL below) authorize its writes.

## 1. Keep the live website untouched while testing
- Do not delete your Vercel project, GitHub repo, or Supabase project.
- Extract this ZIP into a **new folder**, e.g. `DAG-ESPORTS-NEW`.
- Do not copy in old experimental Google/OAuth, PIN, or `admin-session` files.
- This ZIP deliberately does **not** include `.env.local`, `node_modules`, `.next`, or a stale lockfile.

## 2. In VS Code, open the NEW folder
Open Terminal in this project and run:

    npm install
    npm run dev

The dependency `@supabase/ssr` is in `package.json`; npm install will also create `package-lock.json`.

## 3. Set your existing Supabase values
Create `.env.local` at the PROJECT ROOT, next to package.json. See `.env.example`.
Use your **existing working DAG Supabase** project URL and anon key:

    NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_EXISTING_SUPABASE_ANON_KEY

Do not copy old `DAG_ADMIN_PASSWORD_HASH`, `DAG_ADMIN_SESSION_SECRET`, Google credentials, or any service-role key. Keep `.env.local` private. Restart npm run dev after creating the file.

## 4. Check current Supabase permissions BEFORE changing anything
Run `supabase/00_INSPECT_FIRST.sql` in Supabase SQL Editor. Save/copy its output and take a Supabase backup. Confirm you selected the correct DAG project.

## 5. Apply RLS carefully
Read `supabase/01_DAG_ADMIN_RLS.sql` entirely before running. It **drops and replaces existing policies** on the 5 DAG tables, keeping data. It requires running as `postgres`. If SQL Editor has a different active role or existing tables are owned by a different role, STOP and inspect rather than changing privileges blindly.

This version makes `players`, `matches`, `match_player_stats`, `team_achievements` and `planner_plans` SELECT-public. This follows your choice to let visitors open Evaluation and Planner, **but it makes all fields in those tables publicly readable via Supabase API**, including date of birth, full name, coach comments, absence reasons, and strategy notes. Do NOT apply unchanged if you intend those fields to remain confidential; replace public base-table SELECT with sanitized views and update the corresponding pages first.

## 6. Create management users
In Supabase > Authentication > Providers ensure Email authentication is enabled.
Supabase > Authentication > Users > Add user. Create ONE management email and strong password. Confirm that account is enabled/confirmed (dashboard can create confirmed users). Repeat for separate managers later. Do not put passwords in SQL.

Disable public email sign-ups in Supabase Auth settings if you don't want visitors creating accounts. Even if enabled, unapproved accounts cannot change DAG data with these RLS rules.

Edit `supabase/02_APPROVE_ONE_MANAGER.sql` replacing only `REPLACE_WITH_MANAGEMENT_EMAIL@example.com` and run it **as postgres** in SQL Editor. Ensure the verification SELECT shows the email you intended. To revoke access later:

    delete from public.admin_users where user_id = 'USER_UUID_HERE';

## 7. Test first on localhost
- Incognito `/admin` => redirects to `/admin/login`.
- Login wrong password => error.
- Login with unapproved Supabase Auth user => blocked.
- Login with approved management email + password => original Admin UI.
- Edit a **test** player record; confirm you can update it (only after backup).
- Public `/`, `/roster`, `/evaluation`, `/planner`, `/team-performance` load.
- Public Planner allows experimenting on map, but only approved managers can save/delete plans.
- Logout => `/admin/login`, and `/admin` redirects again.
- Run `npx tsc --noEmit` and `npm run build` to catch project errors before deployment.

## 8. Vercel
Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel > Project > Settings > Environment Variables. Do **not** add service-role secrets. Push the clean code to GitHub only AFTER the steps above work. Vercel will deploy the pushed code. Production domain needs no Google OAuth callbacks for email+password login.

## Notes
- Project uses Next.js 16 with root `proxy.ts`, root `lib/`, and unchanged Tailwind/Turbopack CSS. `cacheComponents` disabled for compatibility with dynamic server auth.
- Existing Admin CRUD uses Supabase JWT/cookies and is enforced by RLS; no custom password API or bypassRLS secret is needed.
- Avoid directly exposing DOB, full names, coach feedback, and strategy notes; use public-safe views before going public with that data.
- If `record new has no field updated_at` recurs, inspect the actual player trigger, table and schema instead of adding columns blindly.
- This ZIP is source only; dependency install and production credentials are performed on your own machine.
