import { describe, it, expect, vi } from "vitest";
import { computeStandings } from "@/lib/leaderboard";

const userId = "user-1";
const profiles = [
  {
    id: userId,
    first_name: "First",
    last_name: "Last",
    tribe_name: "Test Tribe",
  },
];
const tribeEntries = [
  {
    user_id: userId,
    contestant_id: "c01",
    is_wild_card: false,
    added_at_episode: 1,
    removed_at_episode: null,
  },
];
const seasonState = { current_episode: 2 };
const captainPicks = [
  { user_id: userId, episode_id: 1, contestant_id: "c01" },
  { user_id: userId, episode_id: 2, contestant_id: "c01" },
];
const contestantEpisodePoints = [
  { episode_id: 1, contestant_id: "c01", total_points: 10 },
  { episode_id: 2, contestant_id: "c01", total_points: 5 },
];

function mockFrom(table: string) {
  if (table === "profiles") {
    return {
      select: () => ({
        in: () => Promise.resolve({ data: profiles, error: null }),
      }),
    };
  }
  if (table === "tribe_entries") {
    return {
      select: () => ({
        in: () => ({
          eq: () =>
            Promise.resolve({ data: tribeEntries, error: null }),
        }),
      }),
    };
  }
  if (table === "season_state") {
    return {
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: seasonState, error: null }),
        }),
      }),
    };
  }
  if (table === "captain_picks") {
    return {
      select: () => ({
        in: () => Promise.resolve({ data: captainPicks, error: null }),
      }),
    };
  }
  if (table === "contestant_episode_points") {
    return {
      select: () => ({
        lte: () => ({
          order: () => ({
            order: () =>
              Promise.resolve({
                data: contestantEpisodePoints,
                error: null,
              }),
          }),
        }),
      }),
    };
  }
  return {
    select: () => ({
      in: () => Promise.resolve({ data: [], error: null }),
      lte: () => ({ order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
    }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}));

describe("Leaderboard reads from contestant_episode_points", () => {
  it("computeStandings sums stored points and applies captain 2x", async () => {
    const standings = await computeStandings([userId]);
    expect(standings.length).toBe(1);
    expect(standings[0].user_id).toBe(userId);
    expect(standings[0].tribe_name).toBe("Test Tribe");
    expect(standings[0].total_points).toBe((10 * 2) + (5 * 2));
  });
});
