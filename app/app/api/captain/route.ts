import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } as HeadersInit };

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { user_id, supabase } = auth;

  const [{ data: picksData, error: picksError }, { data: seasonData }] = await Promise.all([
    supabase.from("captain_picks").select("episode_id, contestant_id").eq("user_id", user_id),
    supabase.from("season_state").select("current_episode").eq("id", "current").single(),
  ]);

  if (picksError) {
    return NextResponse.json({ error: picksError.message }, { status: 500, ...NO_STORE });
  }

  const picks = (picksData ?? []).reduce(
    (acc, r) => {
      acc[r.episode_id] = r.contestant_id;
      return acc;
    },
    {} as Record<number, string>
  );

  const currentEpisode = seasonData?.current_episode ?? 1;
  if (picks[currentEpisode]) {
    return NextResponse.json({ picks }, NO_STORE);
  }

  // Auto-assign captain for current episode if none set: use first current roster member
  const { data: entries } = await supabase
    .from("tribe_entries")
    .select("contestant_id, added_at_episode")
    .eq("user_id", user_id)
    .eq("phase", "pre_merge")
    .is("removed_at_episode", null)
    .order("added_at_episode")
    .limit(1);

  const firstEntry = (entries ?? [])[0];
  if (firstEntry) {
    await supabase.from("captain_picks").upsert(
      {
        user_id,
        episode_id: currentEpisode,
        contestant_id: firstEntry.contestant_id,
      },
      { onConflict: "user_id,episode_id" }
    );
    picks[currentEpisode] = firstEntry.contestant_id;
  }

  return NextResponse.json({ picks }, NO_STORE);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { user_id, supabase } = auth;

    const body = (await request.json()) as { episode_id: number; contestant_id: string };
    const { episode_id, contestant_id } = body;

    if (!episode_id || !contestant_id) {
      return NextResponse.json(
        { error: "episode_id and contestant_id required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("captain_picks").upsert(
      {
        user_id,
        episode_id,
        contestant_id,
      },
      { onConflict: "user_id,episode_id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
