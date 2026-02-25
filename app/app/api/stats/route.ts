import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { getAuthenticatedUser } from "@/lib/getUser";
import type { SupabaseClient as SupabaseClientType } from "@supabase/supabase-js";
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

function bucketCategory(
  label: string,
  points: number
): Partial<Record<keyof ContestantStats, number>> {
  const lower = label.toLowerCase();
  const out: Partial<Record<keyof ContestantStats, number>> = {};
  if (lower.includes("episode rank bonus")) out.bonus_points = points;
  else if (lower.includes("immunity") && points > 0) out.challenges_won = 1;
  else if (lower.includes("team reward") && lower.includes("1st") && points > 0)
    out.challenges_won = 1;
  else if (lower.includes("confessional")) out.confessional_points = points;
  else if (
    lower.includes("vote matched") ||
    lower.includes("correct target") ||
    lower.includes("zero votes") ||
    lower.includes("voted out")
  )
    out.tribal_points = points;
  else if (
    lower.includes("clue") ||
    lower.includes("advantage") ||
    lower.includes("idol")
  )
    out.advantage_points = points;
  else if (lower === "survival") out.survival_points = points;
  return out;
}

async function computeStats(
  supabase: SupabaseClientType
): Promise<ContestantStats[]> {
  const contestantsRes = await supabase
    .from("contestants")
    .select(
      "id, name, starting_tribe, photo_url, pre_merge_price, physicality, cognition, strategy, influence, resilience"
    )
    .order("id");
  let contestants: {
    id: string;
    name: string;
    starting_tribe: string;
    photo_url?: string;
    pre_merge_price: number;
    physicality?: number;
    cognition?: number;
    strategy?: number;
    influence?: number;
    resilience?: number;
  }[];
  if (contestantsRes.error || !contestantsRes.data?.length) {
    const fallback = await supabase
      .from("contestants")
      .select("id, name, starting_tribe, photo_url, pre_merge_price")
      .order("id");
    const list = fallback.data ?? [];
    contestants = list.map((c) => ({
      ...c,
      physicality: 50,
      cognition: 50,
      strategy: 50,
      influence: 50,
      resilience: 50,
    }));
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
    ? (contestantsSeed as {
        id: string;
        name: string;
        starting_tribe: string;
        photo_url?: string;
        pre_merge_price: number;
      }[])
    : [];
  if (contestants.length === 0 && seedList.length > 0) {
    contestants = seedList.map((c) => ({
      ...c,
      physicality: 50,
      cognition: 50,
      strategy: 50,
      influence: 50,
      resilience: 50,
    }));
  }

  const seasonRes = await supabase
    .from("season_state")
    .select("current_episode")
    .eq("id", "current")
    .single();
  const currentEpisode =
    (seasonRes.data as { current_episode?: number } | null)?.current_episode ?? 1;

  const [pricesRes, pointsRes] = await Promise.all([
    supabase
      .from("contestant_episode_prices")
      .select("contestant_id, price")
      .eq("episode_id", currentEpisode),
    supabase
      .from("contestant_episode_points")
      .select("episode_id, contestant_id, total_points, breakdown")
      .lte("episode_id", currentEpisode)
      .order("episode_id")
      .order("contestant_id"),
  ]);

  const priceRows = (pricesRes.data ?? []) as { contestant_id: string; price: number }[];
  const pointsRows = (pointsRes.data ?? []) as {
    episode_id: number;
    contestant_id: string;
    total_points: number;
    breakdown: Record<string, number>;
  }[];

  const pricesForCurrent = new Map(priceRows.map((r) => [r.contestant_id, r.price]));

  const pointsByContestant = new Map<
    string,
    { total: number; byEpisode: Map<number, number>; breakdowns: Record<number, Record<string, number>> }
  >();
  for (const r of pointsRows) {
    if (r.episode_id > currentEpisode) continue;
    let entry = pointsByContestant.get(r.contestant_id);
    if (!entry) {
      entry = { total: 0, byEpisode: new Map(), breakdowns: {} };
      pointsByContestant.set(r.contestant_id, entry);
    }
    entry.total += r.total_points;
    entry.byEpisode.set(r.episode_id, r.total_points);
    entry.breakdowns[r.episode_id] = (r.breakdown as Record<string, number>) ?? {};
  }

  const maxEpId = currentEpisode;

  return contestants.map((c) => {
    const price = pricesForCurrent.get(c.id) ?? c.pre_merge_price;
    const pointsEntry = pointsByContestant.get(c.id);

    let totalPoints = 0;
    let latestWeekPoints = 0;
    let challengesWon = 0;
    let bonusPoints = 0;
    let confessionalPoints = 0;
    let tribalPoints = 0;
    let advantagePoints = 0;
    let survivalPoints = 0;

    if (pointsEntry) {
      totalPoints = pointsEntry.total;
      latestWeekPoints = pointsEntry.byEpisode.get(maxEpId) ?? 0;
      for (const epId of Object.keys(pointsEntry.breakdowns)) {
        const breakdown = pointsEntry.breakdowns[Number(epId)];
        for (const [label, pts] of Object.entries(breakdown)) {
          const b = bucketCategory(label, pts);
          if (b.bonus_points != null) bonusPoints += b.bonus_points;
          if (b.challenges_won != null) challengesWon += b.challenges_won;
          if (b.confessional_points != null)
            confessionalPoints += b.confessional_points;
          if (b.tribal_points != null) tribalPoints += b.tribal_points;
          if (b.advantage_points != null) advantagePoints += b.advantage_points;
          if (b.survival_points != null) survivalPoints += b.survival_points;
        }
      }
    }

    return {
      id: c.id,
      name: c.name,
      tribe: c.starting_tribe,
      starting_tribe: c.starting_tribe,
      photo_url: c.photo_url ?? "",
      price,
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
