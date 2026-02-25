import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getAuthenticatedUser } from "@/lib/getUser";
import contestantsSeed from "@/seed/contestants.json";
import { createClient } from "@/lib/supabase/server";

const BUDGET = 1_000_000;

async function getContestants(): Promise<{ id: string; name: string; starting_tribe: string; pre_merge_price: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contestants")
    .select("id, name, starting_tribe, pre_merge_price")
    .order("id");
  if (error || !data || data.length === 0) {
    return contestantsSeed as { id: string; name: string; starting_tribe: string; pre_merge_price: number }[];
  }
  return data;
}
const ROSTER_SIZE = 7;
const MIN_PER_TRIBE = 1;

interface TribeSubmitEntry {
  contestant_id: string;
  is_wild_card?: boolean;
}

function validateTribe(
  entries: TribeSubmitEntry[],
  contestants: { id: string; name: string; starting_tribe: string; pre_merge_price: number }[]
): { valid: boolean; error?: string } {
  if (entries.length !== ROSTER_SIZE) {
    return { valid: false, error: `Must select exactly ${ROSTER_SIZE} contestants` };
  }

  const priceMap = new Map(contestants.map((c) => [c.id, Number(c.pre_merge_price)]));
  const tribeMap = new Map(contestants.map((c) => [c.id, c.starting_tribe]));

  let totalCost = 0;
  const tribeCounts: Record<string, number> = { "Tribe A": 0, "Tribe B": 0, "Tribe C": 0 };

  for (const e of entries) {
    const price = priceMap.get(e.contestant_id);
    if (price === undefined) {
      return { valid: false, error: `Unknown contestant: ${e.contestant_id}` };
    }
    totalCost += price;

    const tribe = tribeMap.get(e.contestant_id);
    if (tribe && tribeCounts[tribe] !== undefined) {
      tribeCounts[tribe]++;
    }
  }

  if (totalCost > BUDGET) {
    return { valid: false, error: `Over budget: $${totalCost.toLocaleString()} / $${BUDGET.toLocaleString()}` };
  }

  for (const [tribe, count] of Object.entries(tribeCounts)) {
    if (count < MIN_PER_TRIBE) {
      return { valid: false, error: `Must have at least ${MIN_PER_TRIBE} from ${tribe} (have ${count})` };
    }
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { user_id, supabase } = auth;

    const body = (await request.json()) as { entries: TribeSubmitEntry[] };
    const { entries } = body;

    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { error: "Invalid request: entries must be an array" },
        { status: 400 }
      );
    }

    const contestants = await getContestants();
    const validation = validateTribe(entries, contestants);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    await supabase
      .from("tribe_entries")
      .delete()
      .eq("user_id", user_id)
      .eq("phase", "pre_merge");

    const toInsert = entries.map((e) => ({
      user_id,
      contestant_id: e.contestant_id,
      phase: "pre_merge",
      is_wild_card: false,
      added_at_episode: 1,
    }));

    const { error } = await supabase.from("tribe_entries").insert(toInsert);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const selectedIds = entries.map((e) => e.contestant_id);
    const alphabeticalFirst = contestants
      .filter((c) => selectedIds.includes(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))[0];

    if (alphabeticalFirst) {
      await supabase.from("captain_picks").upsert(
        {
          user_id,
          episode_id: 1,
          contestant_id: alphabeticalFirst.id,
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
