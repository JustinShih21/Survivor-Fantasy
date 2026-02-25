import { describe, it, expect } from "vitest";
import {
  buildCategoryOverrideMap,
  applyCategoryOverridesToBreakdowns,
  type CategoryOverrideRow,
} from "@/lib/applyCategoryOverrides";
import type { ContestantPointsSummary } from "@/lib/scoring";

/**
 * Scores and leaderboard both use buildCategoryOverrideMap + applyCategoryOverridesToBreakdowns
 * from @/lib/applyCategoryOverrides. So the same override rows produce the same totals
 * when applied to the same contestant_breakdowns. This test documents that contract.
 */
describe("Scores / Leaderboard consistency", () => {
  it("same override rows and same breakdowns produce same total from applyCategoryOverridesToBreakdowns", () => {
    const breakdowns: ContestantPointsSummary[] = [
      {
        contestant_id: "c01",
        total_points: 15,
        episodes: [
          {
            episode_id: 1,
            total: 10,
            is_captain: false,
            sources: [
              { label: "Survival", points: 5 },
              { label: "Vote matched", points: 5 },
            ],
          },
          {
            episode_id: 2,
            total: 5,
            is_captain: false,
            sources: [{ label: "Survival", points: 5 }],
          },
        ],
      },
    ];
    const overrides: CategoryOverrideRow[] = [
      { contestant_id: "c01", episode_id: 1, category: "Survival", points: 99 },
    ];
    const map = buildCategoryOverrideMap(overrides);

    const breakdownsCopy: ContestantPointsSummary[] = JSON.parse(JSON.stringify(breakdowns));
    const total1 = applyCategoryOverridesToBreakdowns(breakdownsCopy, map);

    const breakdownsCopy2: ContestantPointsSummary[] = JSON.parse(JSON.stringify(breakdowns));
    const total2 = applyCategoryOverridesToBreakdowns(breakdownsCopy2, map);

    expect(total1).toBe(total2);
    expect(total1).toBe(99 + 5 + 5);
    expect(breakdownsCopy[0].total_points).toBe(breakdownsCopy2[0].total_points);
  });
});
