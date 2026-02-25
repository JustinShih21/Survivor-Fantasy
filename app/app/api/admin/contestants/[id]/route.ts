import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { materializePricesForEpisodes } from "@/lib/materializePrices";

export const dynamic = "force-dynamic";

const PRICE_MIN = 50_000;
const PRICE_MAX = 300_000;
const TRAIT_MIN = 1;
const TRAIT_MAX = 100;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Contestant id required" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      pre_merge_price?: number;
      physicality?: number;
      cognition?: number;
      strategy?: number;
      influence?: number;
      resilience?: number;
    };

    const updates: Record<string, number> = {};

    if (body.pre_merge_price !== undefined) {
      const p = Number(body.pre_merge_price);
      if (Number.isNaN(p) || p < PRICE_MIN || p > PRICE_MAX) {
        return NextResponse.json(
          { error: `pre_merge_price must be ${PRICE_MIN}-${PRICE_MAX}` },
          { status: 400 }
        );
      }
      updates.pre_merge_price = p;
    }

    for (const key of ["physicality", "cognition", "strategy", "influence", "resilience"] as const) {
      if (body[key] !== undefined) {
        const v = Number(body[key]);
        if (Number.isNaN(v) || v < TRAIT_MIN || v > TRAIT_MAX) {
          return NextResponse.json(
            { error: `${key} must be ${TRAIT_MIN}-${TRAIT_MAX}` },
            { status: 400 }
          );
        }
        updates[key] = v;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
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
      .from("contestants")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("column") && msg.includes("does not exist")) {
        return NextResponse.json(
          { error: "Run the contestant traits migration first (00014_contestant_traits.sql)." },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (updates.pre_merge_price !== undefined) {
      try {
        const { data: seasonRow } = await admin.from("season_state").select("current_episode").eq("id", "current").single();
        const currentEpisode = Math.max(1, (seasonRow as { current_episode?: number } | null)?.current_episode ?? 1);
        await materializePricesForEpisodes(currentEpisode, admin);
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
