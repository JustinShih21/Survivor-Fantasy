#!/usr/bin/env node
/**
 * Apply contestant trait scores from JSON to Supabase contestants table.
 * Only updates: physicality, cognition, strategy, influence, resilience (1-100).
 *
 * Usage (run from app directory so @supabase/supabase-js is available):
 *   cd app && node ../scripts/apply-contestant-scores.mjs [path/to/contestant_trait_scores.json]
 *
 * Default JSON path: scripts/data/contestant_trait_scores.json (relative to repo root).
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. The script loads app/.env.local
 * when run from app (or repo root) if present.
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TRAIT_KEYS = ["physicality", "cognition", "strategy", "influence", "resilience"];
const MIN = 1;
const MAX = 100;

function loadEnvFrom(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function ensureEnv() {
  const fromRoot = join(process.cwd(), "app", ".env.local");
  const fromApp = join(process.cwd(), ".env.local");
  if (existsSync(fromRoot)) loadEnvFrom(fromRoot);
  else if (existsSync(fromApp)) loadEnvFrom(fromApp);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set in app/.env.local or environment.");
    process.exit(1);
  }
  return { url, key };
}

function validateEntry(id, obj) {
  const errs = [];
  for (const key of TRAIT_KEYS) {
    const v = obj[key];
    if (v === undefined || v === null) {
      errs.push(`missing ${key}`);
      continue;
    }
    const n = Number(v);
    if (!Number.isInteger(n) || n < MIN || n > MAX) errs.push(`${key}=${v} (must be integer ${MIN}-${MAX})`);
  }
  return errs;
}

async function main() {
  const defaultPath = join(__dirname, "data", "contestant_trait_scores.json");
  const inputPath = resolve(process.argv[2] || defaultPath);

  if (!existsSync(inputPath)) {
    console.error("File not found:", inputPath);
    console.error("Default:", defaultPath);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (e) {
    console.error("Invalid JSON:", e.message);
    process.exit(1);
  }

  if (typeof data !== "object" || data === null) {
    console.error("JSON must be an object keyed by contestant id (c01..c24).");
    process.exit(1);
  }

  const { url, key } = ensureEnv();
  const supabase = createClient(url, key);

  let updated = 0;
  let skipped = 0;

  for (const [id, entry] of Object.entries(data)) {
    if (!/^c\d{2}$/.test(id) || id < "c01" || id > "c24") {
      console.warn("Skipping invalid id:", id);
      skipped++;
      continue;
    }
    const errs = validateEntry(id, entry);
    if (errs.length) {
      console.warn("Skipping", id, "-", errs.join("; "));
      skipped++;
      continue;
    }
    const updates = {};
    for (const k of TRAIT_KEYS) updates[k] = Number(entry[k]);
    const { error } = await supabase.from("contestants").update(updates).eq("id", id).select().single();
    if (error) {
      console.warn("Update failed for", id, "-", error.message);
      skipped++;
      continue;
    }
    updated++;
  }

  console.log("Updated", updated, "contestants; skipped", skipped);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
