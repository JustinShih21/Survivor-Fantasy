import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const REQUIRED_TOP_LEVEL = [
  "survival",
  "placement",
  "team_immunity",
  "team_reward",
  "tribal",
  "advantages",
  "other",
] as const;

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const out = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const s = source[key];
    if (s === undefined) continue;
    const t = target[key];
    if (
      s !== null &&
      typeof s === "object" &&
      !Array.isArray(s) &&
      t !== null &&
      typeof t === "object" &&
      !Array.isArray(t)
    ) {
      (out as Record<string, unknown>)[key as string] = deepMerge(
        t as Record<string, unknown>,
        s as Record<string, unknown>
      ) as T[keyof T];
    } else {
      (out as Record<string, unknown>)[key as string] = s;
    }
  }
  return out;
}

function validateConfig(cfg: unknown): { ok: true; config: Record<string, unknown> } | { ok: false; error: string } {
  if (cfg === null || typeof cfg !== "object" || Array.isArray(cfg)) {
    return { ok: false, error: "Config must be an object" };
  }
  const c = cfg as Record<string, unknown>;
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in c) || c[key] === null || typeof c[key] !== "object" || Array.isArray(c[key])) {
      return { ok: false, error: `Missing or invalid top-level key: ${key}` };
    }
  }
  if (typeof c.individual_immunity !== "number" || Number.isNaN(c.individual_immunity)) {
    return { ok: false, error: "individual_immunity must be a number" };
  }
  return { ok: true, config: c };
}

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Admin client not configured")) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
    }
    throw e;
  }

  const { data, error } = await admin
    .from("scoring_config")
    .select("config")
    .eq("id", "default")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.config) {
    return NextResponse.json({ error: "Scoring config not found" }, { status: 404 });
  }

  return NextResponse.json(data.config as Record<string, unknown>);
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Admin client not configured")) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
    }
    throw e;
  }

  const { data: existingRow, error: fetchError } = await admin
    .from("scoring_config")
    .select("config")
    .eq("id", "default")
    .single();

  if (fetchError || !existingRow?.config) {
    return NextResponse.json(
      { error: fetchError?.message ?? "Scoring config not found" },
      { status: fetchError ? 500 : 404 }
    );
  }

  const existing = existingRow.config as Record<string, unknown>;
  const merged = deepMerge(existing, body as Record<string, unknown>);
  const validated = validateConfig(merged);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from("scoring_config")
    .update({ config: validated.config })
    .eq("id", "default");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(validated.config);
}
