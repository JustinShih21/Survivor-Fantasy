import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import contestantsSeed from "@/seed/contestants.json";

const BUDGET = 1_000_000;
const ROSTER_SIZE = 7;
const MIN_PER_TRIBE = 1;

interface TransferRequest {
  sells: string[];
  adds: { contestant_id: string; is_wild_card?: boolean }[];
  current_episode: number;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { user_id, supabase } = auth;

    const body = (await request.json()) as TransferRequest;
    const { sells, adds, current_episode } = body;

    if (!Array.isArray(sells) || !Array.isArray(adds)) {
      return NextResponse.json(
        { error: "sells and adds must be arrays" },
        { status: 400 }
      );
    }

    if (sells.length !== adds.length) {
      return NextResponse.json(
        { error: "Must sell and add same number of players" },
        { status: 400 }
      );
    }

    if (sells.length === 0) {
      return NextResponse.json({ success: true });
    }

    const { data: currentEntries, error: fetchError } = await supabase
      .from("tribe_entries")
      .select("contestant_id, is_wild_card, added_at_episode, removed_at_episode")
      .eq("user_id", user_id)
      .eq("phase", "pre_merge");

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const roster = (currentEntries ?? []).filter(
      (r) => (r as { removed_at_episode?: number | null }).removed_at_episode == null
    );
    const rosterIds = new Set(roster.map((r) => r.contestant_id));

    // Validate sells
    for (const cid of sells) {
      if (!rosterIds.has(cid)) {
        return NextResponse.json({ error: `Not on roster: ${cid}` }, { status: 400 });
      }
    }

    // Get eliminated contestants up to current_episode
    const { data: outcomes } = await supabase
      .from("episode_outcomes")
      .select("outcome")
      .lte("episode_id", current_episode)
      .order("episode_id");

    const eliminated = new Set<string>();
    for (const row of outcomes ?? []) {
      const votedOut = (row.outcome as Record<string, unknown>)?.voted_out as string | undefined;
      if (votedOut) eliminated.add(votedOut);
    }

    // Validate adds: not eliminated, not already on roster
    const [contestantsRes, pricesRes] = await Promise.all([
      supabase.from("contestants").select("id, starting_tribe, pre_merge_price").order("id"),
      supabase
        .from("contestant_episode_prices")
        .select("contestant_id, price")
        .eq("episode_id", current_episode),
    ]);
    const contestants =
      (contestantsRes.data ?? []).length > 0
        ? (contestantsRes.data ?? []) as { id: string; starting_tribe: string; pre_merge_price: number }[]
        : (contestantsSeed as { id: string; starting_tribe: string; pre_merge_price: number }[]);
    const tribeMap = new Map(contestants.map((c) => [c.id, c.starting_tribe]));

    const priceMap = new Map<string, number>();
    for (const c of contestants) {
      priceMap.set(c.id, c.pre_merge_price);
    }
    for (const row of pricesRes.data ?? []) {
      const r = row as { contestant_id: string; price: number };
      priceMap.set(r.contestant_id, r.price);
    }

    for (const add of adds) {
      if (eliminated.has(add.contestant_id)) {
        return NextResponse.json(
          { error: `Cannot add eliminated contestant: ${add.contestant_id}` },
          { status: 400 }
        );
      }
      if (rosterIds.has(add.contestant_id) && !sells.includes(add.contestant_id)) {
        return NextResponse.json(
          { error: `Already on roster: ${add.contestant_id}` },
          { status: 400 }
        );
      }
    }

    // Build new roster after transfers (for validation)
    const remainingRoster = roster.filter((r) => !sells.includes(r.contestant_id));
    const newRoster = [...remainingRoster];
    for (const add of adds) {
      newRoster.push({
        contestant_id: add.contestant_id,
        is_wild_card: add.is_wild_card ?? false,
        added_at_episode: current_episode,
        removed_at_episode: null,
      });
    }

    // Validate tribe constraint: at least 1 per tribe
    const tribeCounts: Record<string, number> = { "Tribe A": 0, "Tribe B": 0, "Tribe C": 0 };
    for (const e of newRoster) {
      const tribe = tribeMap.get(e.contestant_id);
      if (tribe && tribeCounts[tribe] !== undefined) tribeCounts[tribe]++;
    }
    for (const [tribe, count] of Object.entries(tribeCounts)) {
      if (count < MIN_PER_TRIBE) {
        return NextResponse.json(
          { error: `Must have at least 1 from ${tribe} (have ${count})` },
          { status: 400 }
        );
      }
    }

    // Validate budget (use dynamic prices)
    let totalCost = 0;
    for (const e of newRoster) {
      totalCost += priceMap.get(e.contestant_id) ?? contestants.find((c) => c.id === e.contestant_id)?.pre_merge_price ?? 0;
    }
    if (totalCost > BUDGET) {
      return NextResponse.json(
        { error: `Over budget: $${totalCost.toLocaleString()}` },
        { status: 400 }
      );
    }

    if (newRoster.length !== ROSTER_SIZE) {
      return NextResponse.json(
        { error: `Roster must have ${ROSTER_SIZE} players (have ${newRoster.length})` },
        { status: 400 }
      );
    }

    // Soft-delete sold entries (set removed_at_episode so points stay)
    for (const cid of sells) {
      const { error: updateError } = await supabase
        .from("tribe_entries")
        .update({ removed_at_episode: current_episode })
        .eq("user_id", user_id)
        .eq("phase", "pre_merge")
        .eq("contestant_id", cid);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    for (const add of adds) {
      const { data: existing } = await supabase
        .from("tribe_entries")
        .select("id")
        .eq("user_id", user_id)
        .eq("phase", "pre_merge")
        .eq("contestant_id", add.contestant_id)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("tribe_entries")
          .update({
            removed_at_episode: null,
            added_at_episode: current_episode,
            is_wild_card: add.is_wild_card ?? false,
          })
          .eq("user_id", user_id)
          .eq("phase", "pre_merge")
          .eq("contestant_id", add.contestant_id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
      } else {
        const { error: insertError } = await supabase.from("tribe_entries").insert({
          user_id,
          contestant_id: add.contestant_id,
          phase: "pre_merge",
          is_wild_card: add.is_wild_card ?? false,
          added_at_episode: current_episode,
        });

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }

    // If current captain was transferred out, set the replacement add as the new captain
    const { data: captainRows } = await supabase
      .from("captain_picks")
      .select("contestant_id")
      .eq("user_id", user_id)
      .eq("episode_id", current_episode)
      .maybeSingle();

    const currentCaptain = captainRows?.contestant_id ?? null;
    if (currentCaptain && sells.includes(currentCaptain) && adds.length > 0) {
      const captainSellIndex = sells.indexOf(currentCaptain);
      const newCaptainId = captainSellIndex >= 0 && adds[captainSellIndex]
        ? adds[captainSellIndex].contestant_id
        : adds[0].contestant_id;
      await supabase.from("captain_picks").upsert(
        {
          user_id,
          episode_id: current_episode,
          contestant_id: newCaptainId,
        },
        { onConflict: "user_id,episode_id" }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
