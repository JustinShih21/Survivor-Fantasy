# Survivor Fantasy — Deployment and Domain Migration

Step-by-step guide to deploy the app to Vercel and attach a custom domain, with Supabase Auth configured for production.

## Prerequisites

- A **domain** you control (e.g. survivorfantasy.com).
- **Vercel** account; repo pushed to GitHub/GitLab/Bitbucket.
- **Supabase** project (production); migrations applied.

---

## 1. Vercel: Connect and deploy

1. Log in to [Vercel](https://vercel.com); **Add New** → **Project**.
2. Import your repository; select the **root** of the repo (or the `app` directory if the Next.js app lives there—adjust **Root Directory** in project settings if needed).
3. **Environment variables** (add for Production, and optionally Preview):

   | Name | Value | Notes |
   |------|--------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` | From Supabase → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon public key) | Same place |
   | `SUPABASE_SERVICE_ROLE_KEY` | (service_role key) | **Secret**; Supabase → Settings → API → service_role |
   | `ADMIN_USER_IDS` | `uuid1,uuid2` | Comma-separated auth user UUIDs who can access `/admin` |

4. Deploy. Confirm the app loads on `https://your-project.vercel.app` and that login/signup work (Supabase Auth redirect URLs must include this URL—see step 3 below).

---

## 2. Custom domain on Vercel

1. In Vercel: **Project** → **Settings** → **Domains**.
2. Add your domain (e.g. `survivorfantasy.com` or `www.survivorfantasy.com`).
3. Vercel shows DNS instructions. At your **domain registrar**:
   - **A record:** Host `@` (or your subdomain), value `76.76.21.21`, or
   - **CNAME:** Host `www` (or subdomain), value `cname.vercel-dns.com`.
4. Wait for DNS propagation (minutes to 48 hours). Vercel will provision SSL automatically.

---

## 3. Supabase Auth: Production URLs

1. In **Supabase** → **Authentication** → **URL Configuration**:
   - **Site URL:** set to your production URL, e.g. `https://survivorfantasy.com` (or your Vercel domain).
   - **Redirect URLs:** add `https://yourdomain.com/**` and `https://www.yourdomain.com/**` if you use both. Keep `http://localhost:3000/**` for local development.
2. Ensure the **Supabase project URL and anon key** used in Vercel env vars are for this same (production) project.

---

## 4. Environment variables reference

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL; used by client and server | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key; used by client and server for auth and RLS | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key; server-only; bypasses RLS; used by admin APIs and account delete | Yes (for admin and account delete) |
| `ADMIN_USER_IDS` | Comma-separated list of auth user UUIDs who can access `/admin` | Yes (for admin panel) |

Optional for future use:

- `NEXT_PUBLIC_APP_URL` — Canonical app URL for emails or links (e.g. `https://survivorfantasy.com`).

---

## 5. Post-migration

1. **Migrations:** Run all migrations in `app/supabase/migrations/` against the production Supabase DB (Supabase Dashboard → SQL Editor, or `supabase db push` if using Supabase CLI linked to prod).
2. **Smoke test:** Sign up, log in, build tribe, create a league, view Points and Leagues/leaderboard; as an admin user, open `/admin` and confirm access.
3. **README:** Local setup remains `npm install`, copy `.env.local.example` to `.env.local`, fill in the same vars for local dev, then `npm run dev`.

---

## Summary

1. Deploy to Vercel with env vars set.
2. Add custom domain in Vercel and configure DNS.
3. Set Supabase Auth Site URL and Redirect URLs to the production domain.
4. Run migrations on production DB and run a smoke test.
