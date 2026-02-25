import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { POINT_BREAKDOWN_CATEGORIES } from "@/lib/scoring";
import { materializePointsForEpisode } from "@/lib/materializePoints";

export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES = new Set(POINT_BREAKDOWN_CATEGORIES);

function getAdminClient() {
  try {
    return createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Admin client not configured")) {
      return null;
    }
    throw e;
  }
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get("episode_id");

  let query = admin
    .from("point_category_overrides")
    .select("contestant_id, episode_id, category, points")
    .order("episode_id")
    .order("contestant_id")
    .order("category");
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
    const body = (await request.json()) as {
      contestant_id?: string;
      episode_id?: number;
      category?: string;
      points?: number | null;
    };
    const { contestant_id, episode_id, category, points } = body;
    if (!contestant_id || episode_id == null || typeof episode_id !== "number" || !category || typeof category !== "string") {
      return NextResponse.json(
        { error: "contestant_id, episode_id, and category are required" },
        { status: 400 }
      );
    }
    if (!ALLOWED_CATEGORIES.has(category as (typeof POINT_BREAKDOWN_CATEGORIES)[number])) {
      return NextResponse.json(
        { error: `category must be one of: ${POINT_BREAKDOWN_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
    }

    if (points == null || (typeof points === "number" && Number.isNaN(points))) {
      const { error } = await admin
        .from("point_category_overrides")
        .delete()
        .eq("contestant_id", contestant_id)
        .eq("episode_id", episode_id)
        .eq("category", category);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      try {
        await materializePointsForEpisode(episode_id, admin);
      } catch {
        // non-fatal: canonical table may not exist yet
      }
      return NextResponse.json({ contestant_id, episode_id, category, points: null });
    }

    const { data, error } = await admin
      .from("point_category_overrides")
      .upsert(
        { contestant_id, episode_id, category, points },
        { onConflict: "contestant_id,episode_id,category" }
      )
      .select("contestant_id, episode_id, category, points")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    try {
      await materializePointsForEpisode(episode_id, admin);
    } catch {
      // non-fatal: canonical table may not exist yet
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const deleteAll = searchParams.get("all") === "true";

  if (deleteAll) {
    const { error } = await admin
      .from("point_category_overrides")
      .delete()
      .gte("episode_id", 0);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: seasonRow } = await admin.from("season_state").select("current_episode").eq("id", "current").single();
    const currentEpisode = Math.max(1, (seasonRow as { current_episode?: number } | null)?.current_episode ?? 1);
    for (let ep = 1; ep <= currentEpisode; ep++) {
      try {
        await materializePointsForEpisode(ep, admin);
      } catch {
        // non-fatal
      }
    }
    return NextResponse.json({ ok: true, cleared: "all" });
  }

  const contestant_id = searchParams.get("contestant_id");
  const episode_id = searchParams.get("episode_id");
  const category = searchParams.get("category");

  if (!contestant_id || !episode_id || !category) {
    return NextResponse.json(
      { error: "contestant_id, episode_id, and category query params required (or ?all=true to clear all)" },
      { status: 400 }
    );
  }
  const ep = parseInt(episode_id, 10);
  if (Number.isNaN(ep)) {
    return NextResponse.json({ error: "episode_id must be a number" }, { status: 400 });
  }
  if (!ALLOWED_CATEGORIES.has(category as (typeof POINT_BREAKDOWN_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const { error } = await admin
    .from("point_category_overrides")
    .delete()
    .eq("contestant_id", contestant_id)
    .eq("episode_id", ep)
    .eq("category", category);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  try {
    await materializePointsForEpisode(ep, admin);
  } catch {
    // non-fatal
  }
  return NextResponse.json({ ok: true });
}
