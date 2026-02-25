import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { getAuthenticatedUser } from "@/lib/getUser";
import type { SupabaseClient as SupabaseClientType } from "@supabase/supabase-js";
import { getPricesForEpisode } from "@/lib/prices";
import { buildBreakdownsFromOverrides } from "@/lib/pointsFromOverrides";
import contestantsSeed from "@/seed/contestants.json";

export interface ContestantStats {
  id: string;
  name: string;
  tribe: string | null;
  starting_tribe: string;
  photo_url: string;
  price: number;
  total_points: number;
  latest_week_points: number;
  challenges_won: number;
  bonus_points: number;
  confessional_points: number;
  tribal_points: number;
  advantage_points: number;
  survival_points: number;
  votes_received: number;
  status: "active" | "voted_out" | "quit";
  cognition?: number;
  strategy?: number;
  influence?: number;
  resilience?: number;
  physicality?: number;
}

const CACHE_CONTROL = "no-store";

function bucketCategory(label: string, points: number): Partial<Record<keyof ContestantStats, number>> {
  const lower = label.toLowerCase();
  const out: Partial<Record<keyof ContestantStats, number>> = {};
  if (lower.includes("episode rank bonus")) out.bonus_points = points;
  else if (lower.includes("immunity") && points > 0) out.challenges_won = 1;
  else if (lower.includes("team reward") && lower.includes("1st") && points > 0) out.challenges_won = 1;
  else if (lower.includes("confessional")) out.confessional_points = points;
  else if (lower.includes("vote matched") || lower.includes("correct target") || lower.includes("zero votes") || lower.includes("voted out")) out.tribal_points = points;
  else if (lower.includes("clue") || lower.includes("advantage") || lower.includes("idol")) out.advantage_points = points;
  else if (lower === "survival") out.survival_points = points;
  return out;
}

async function computeStats(supabase: SupabaseClientType): Promise<ContestantStats[]> {
  const contestantsRes = await supabase
    .from("contestants")
    .select("id, name, starting_tribe, photo_url, pre_merge_price, physicality, cognition, strategy, influence, resilience")
    .order("id");
  let contestants: { id: string; name: string; starting_tribe: string; photo_url?: string; pre_merge_price: number; physicality?: number; cognition?: number; strategy?: number; influence?: number; resilience?: number }[];
  if (contestantsRes.error || !contestantsRes.data?.length) {
    const fallback = await supabase
      .from("contestants")
      .select("id, name, starting_tribe, photo_url, pre_merge_price")
      .order("id");
    const list = fallback.data ?? [];
    contestants = list.map((c) => ({ ...c, physicality: 50, cognition: 50, strategy: 50, influence: 50, resilience: 50 }));
  } else {
    contestants = (contestantsRes.data ?? []).map((c) => ({
      ...c,
      physicality: c.physicality ?? 50,
      cognition: c.cognition ?? 50,
      strategy: c.strategy ?? 50,
      influence: c.influence ?? 50,
      resilience: c.resilience ?? 50,
    }));
  }
  const seedList = Array.isArray(contestantsSeed)
    ? (contestantsSeed as { id: string; name: string; starting_tribe: string; photo_url?: string; pre_merge_price: number }[])
    : [];
  if (contestants.length === 0 && seedList.length > 0) {
    contestants = seedList.map((c) => ({ ...c, physicality: 50, cognition: 50, strategy: 50, influence: 50, resilience: 50 }));
  }

  const [overridesRes, seasonRes] = await Promise.all([
    supabase.from("point_category_overrides").select("contestant_id, episode_id, category, points"),
    supabase.from("season_state").select("current_episode").eq("id", "current").single(),
  ]);

  const currentEpisode = seasonRes.data?.current_episode ?? 1;
  const prices = await getPricesForEpisode(currentEpisode);

  const overrideRows = (overridesRes.data ?? []) as { contestant_id: string; episode_id: number; category: string; points: number }[];
  const { contestant_breakdowns } = buildBreakdownsFromOverrides(overrideRows, {});

  const maxEpId =
    overrideRows.length > 0
      ? Math.max(...overrideRows.map((r) => r.episode_id))
      : currentEpisode;

  return contestants.map((c) => {
    const breakdown = contestant_breakdowns.find((b) => b.contestant_id === c.id);
    let challengesWon = 0;
    let bonusPoints = 0;
    let confessionalPoints = 0;
    let tribalPoints = 0;
    let advantagePoints = 0;
    let survivalPoints = 0;

    if (breakdown) {
      for (const ep of breakdown.episodes) {
        for (const s of ep.sources) {
          const b = bucketCategory(s.label, s.points);
          if (b.bonus_points != null) bonusPoints += b.bonus_points;
          if (b.challenges_won != null) challengesWon += b.challenges_won;
          if (b.confessional_points != null) confessionalPoints += b.confessional_points;
          if (b.tribal_points != null) tribalPoints += b.tribal_points;
          if (b.advantage_points != null) advantagePoints += b.advantage_points;
          if (b.survival_points != null) survivalPoints += b.survival_points;
        }
      }
    }

    const totalPoints = breakdown?.total_points ?? 0;
    const latestWeekPoints = breakdown?.episodes?.length
      ? (breakdown.episodes.find((e) => e.episode_id === maxEpId) ?? breakdown.episodes[breakdown.episodes.length - 1])?.total ?? 0
      : 0;

    return {
      id: c.id,
      name: c.name,
      tribe: c.starting_tribe,
      starting_tribe: c.starting_tribe,
      photo_url: c.photo_url ?? "",
      price: prices[c.id] ?? c.pre_merge_price,
      total_points: totalPoints,
      latest_week_points: latestWeekPoints,
      challenges_won: challengesWon,
      bonus_points: bonusPoints,
      confessional_points: confessionalPoints,
      tribal_points: tribalPoints,
      advantage_points: advantagePoints,
      survival_points: survivalPoints,
      votes_received: 0,
      status: "active" as const,
      cognition: c.cognition ?? 50,
      strategy: c.strategy ?? 50,
      influence: c.influence ?? 50,
      resilience: c.resilience ?? 50,
      physicality: c.physicality ?? 50,
    };
  });
}

export async function GET() {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { supabase } = auth;

    const stats = await computeStats(supabase);

    return NextResponse.json(
      { stats },
      { headers: { "Cache-Control": CACHE_CONTROL } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
