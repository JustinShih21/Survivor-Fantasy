/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * One-off: delete all rows from point_category_overrides (zeros all contestant points).
 * Run from app dir: node scripts/clear-point-overrides.cjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, key);

async function main() {
  const { error } = await admin
    .from("point_category_overrides")
    .delete()
    .gte("episode_id", 0);
  if (error) {
    console.error("Delete failed:", error.message);
    process.exit(1);
  }
  console.log("Cleared all point_category_overrides. All contestant points are now zero.");
}

main();
