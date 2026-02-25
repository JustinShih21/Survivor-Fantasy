import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get("episode_id");

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
  let query = admin.from("point_overrides").select("contestant_id, episode_id, points").order("episode_id").order("contestant_id");
  if (episodeId != null && episodeId !== "") {
    const ep = parseInt(episodeId, 10);
    if (!Number.isNaN(ep)) {
      query = query.eq("episode_id", ep);
    }
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { contestant_id?: string; episode_id?: number; points?: number | null };
    const { contestant_id, episode_id, points } = body;
    if (!contestant_id || episode_id == null || typeof episode_id !== "number") {
      return NextResponse.json(
        { error: "contestant_id and episode_id required" },
        { status: 400 }
      );
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

    if (points == null || (typeof points === "number" && Number.isNaN(points))) {
      const { error } = await admin
        .from("point_overrides")
        .delete()
        .eq("contestant_id", contestant_id)
        .eq("episode_id", episode_id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ contestant_id, episode_id, points: null });
    }

    const { data, error } = await admin
      .from("point_overrides")
      .upsert(
        { contestant_id, episode_id, points },
        // Composite primary key (contestant_id, episode_id); table has PRIMARY KEY (contestant_id, episode_id)
        { onConflict: "contestant_id,episode_id" }
      )
      .select("contestant_id, episode_id, points")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
