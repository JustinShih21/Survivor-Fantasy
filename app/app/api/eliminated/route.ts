import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } as HeadersInit };

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const throughEpisode = parseInt(searchParams.get("through") ?? "6", 10);

  const { data, error } = await supabase
    .from("episode_outcomes")
    .select("outcome")
    .lte("episode_id", throughEpisode)
    .order("episode_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, ...NO_STORE });
  }

  const eliminated = new Set<string>();
  for (const row of data ?? []) {
    const votedOut = (row.outcome as Record<string, unknown>)?.voted_out as string | undefined;
    if (votedOut) eliminated.add(votedOut);
  }

  return NextResponse.json({ eliminated: Array.from(eliminated) }, NO_STORE);
}
