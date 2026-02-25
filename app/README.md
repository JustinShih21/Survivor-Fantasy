# Survivor Fantasy Prototype

Minimal single-user prototype: tribe builder, scoring, transfers, captain selection.

## Setup

1. **Create Supabase project** at [supabase.com](https://supabase.com)

2. **Run migrations** in Supabase SQL Editor:
   - Run `supabase/migrations/00001_initial_schema.sql`
   - Run `supabase/migrations/00002_seed_data.sql`

3. **Configure environment** - copy `.env.local.example` to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
   For admin: set `ADMIN_USER_IDS` (comma-separated auth UUIDs) and `SUPABASE_SERVICE_ROLE_KEY`. Run migrations in order (`00001`–`00015`); `00014` is idempotent.

4. **Regenerate seed data** (optional):
   ```bash
   cd ../scripts/point_simulation && python export_seed_data.py
   ```

5. **Run dev server**:
   ```bash
   npm run dev
   ```

**Validation (lint + build):**
```bash
npm run validate
```

## Manual verification checklist (admin)

- **Auth and admin gate:** Log in as non-admin → `/admin` redirects to `/`, Admin link hidden. Log in as admin (UUID in `ADMIN_USER_IDS`) → Admin link visible, `/admin` loads.
- **Season:** As admin, set current episode; reload app; Points/Home reflect it.
- **Point overrides:** Set override for one contestant/episode; open Points as that user; episode total uses override; leaderboard total matches.
- **Home content:** Add a published article; home page shows card; `/article/[slug]` shows body. Unpublish/delete and confirm UI updates.
- **Resilience:** With `point_overrides` or `home_page_content` table missing, app still loads (empty overrides / no home cards). With trait columns missing, contestants load; admin Traits save returns a clear error.

**Clear all point overrides (zeros every contestant’s points):** Admin UI → Point overrides by category → “Clear all overrides”, or from app dir: `node scripts/clear-point-overrides.cjs` (requires `.env.local` with `SUPABASE_SERVICE_ROLE_KEY`).

## Production deploy and custom domain

See **[../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)** for step-by-step Vercel deploy, environment variables, custom domain (DNS + Supabase Auth URL config), and post-migration smoke test.

## Flow

1. **Build Tribe** - Select 7 contestants (2 per tribe + 1 wild card) under $1M
2. **My Tribe** - View roster, total points, breakdown
3. **Captain** - Pick captain per episode (2x points)
4. **Transfers** - Sell/add after each episode (-10 per add)
5. **Advance Episode** - Move to next episode
