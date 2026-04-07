import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED_SIDES = new Set(["yes", "no"]);
const ALLOWED_TRANSFORMS = new Set(["direct", "inverse"]);

function getAdminClient() {
  try {
    return createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Admin client not configured")) return null;
    throw e;
  }
}

async function requireAdmin() {
  const auth = await getAuthenticatedUser();
  if (!auth) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (!(await isAdmin(auth.supabase))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const admin = getAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: "Server configuration error" }, { status: 503 }) };
  }
  return { admin };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { admin } = auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let body: {
    category?: string;
    side?: string;
    transform?: string;
    confidence?: number;
    is_active?: boolean;
    notes?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.category !== undefined) {
    const category = body.category.trim();
    if (!category) {
      return NextResponse.json({ error: "category cannot be empty" }, { status: 400 });
    }
    updates.category = category;
  }
  if (body.side !== undefined) {
    const side = body.side.trim();
    if (!ALLOWED_SIDES.has(side)) {
      return NextResponse.json({ error: "side must be 'yes' or 'no'" }, { status: 400 });
    }
    updates.side = side;
  }
  if (body.transform !== undefined) {
    const transform = body.transform.trim();
    if (!ALLOWED_TRANSFORMS.has(transform)) {
      return NextResponse.json({ error: "transform must be 'direct' or 'inverse'" }, { status: 400 });
    }
    updates.transform = transform;
  }
  if (body.confidence !== undefined) {
    const confidence = Number(body.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 5) {
      return NextResponse.json({ error: "confidence must be a number in [0, 5]" }, { status: 400 });
    }
    updates.confidence = confidence;
  }
  if (body.is_active !== undefined) {
    updates.is_active = body.is_active;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes?.trim() || null;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("contestant_market_mappings")
    .update(updates)
    .eq("id", id)
    .select(
      "id, provider, market_ticker, episode_id, contestant_id, category, side, transform, confidence, is_active, notes, created_at, updated_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { admin } = auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await admin
    .from("contestant_market_mappings")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
