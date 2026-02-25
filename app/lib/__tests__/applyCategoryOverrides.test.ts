import { describe, it, expect } from "vitest";
import {
  buildCategoryOverrideMap,
  applyCategoryOverridesToBreakdowns,
  type CategoryOverrideRow,
} from "@/lib/applyCategoryOverrides";
import type { ContestantPointsSummary } from "@/lib/scoring";

describe("buildCategoryOverrideMap", () => {
  it("returns empty map for empty rows", () => {
    const map = buildCategoryOverrideMap([]);
    expect(map.size).toBe(0);
  });

  it("builds key as contestant_id:episode_id and value as category -> points", () => {
    const rows: CategoryOverrideRow[] = [
      { contestant_id: "c01", episode_id: 1, category: "Survival", points: 5 },
      { contestant_id: "c01", episode_id: 1, category: "Vote matched", points: 2 },
      { contestant_id: "c02", episode_id: 1, category: "Survival", points: 10 },
    ];
    const map = buildCategoryOverrideMap(rows);
    expect(map.size).toBe(2);
    expect(map.get("c01:1")?.get("Survival")).toBe(5);
    expect(map.get("c01:1")?.get("Vote matched")).toBe(2);
    expect(map.get("c02:1")?.get("Survival")).toBe(10);
  });
});

describe("applyCategoryOverridesToBreakdowns", () => {
  it("leaves breakdowns unchanged when override map is empty", () => {
    const breakdowns: ContestantPointsSummary[] = [
      {
        contestant_id: "c01",
        total_points: 10,
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
        ],
      },
    ];
    const map = buildCategoryOverrideMap([]);
    const total = applyCategoryOverridesToBreakdowns(breakdowns, map);
    expect(total).toBe(10);
    expect(breakdowns[0].episodes[0].total).toBe(10);
    expect(breakdowns[0].episodes[0].sources).toHaveLength(2);
    expect(breakdowns[0].total_points).toBe(10);
  });

  it("replaces existing source points when override exists for that category", () => {
    const breakdowns: ContestantPointsSummary[] = [
      {
        contestant_id: "c01",
        total_points: 10,
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
        ],
      },
    ];
    const rows: CategoryOverrideRow[] = [
      { contestant_id: "c01", episode_id: 1, category: "Survival", points: 99 },
    ];
    const map = buildCategoryOverrideMap(rows);
    const total = applyCategoryOverridesToBreakdowns(breakdowns, map);
    expect(breakdowns[0].episodes[0].sources.find((s) => s.label === "Survival")?.points).toBe(99);
    expect(breakdowns[0].episodes[0].sources.find((s) => s.label === "Vote matched")?.points).toBe(5);
    expect(breakdowns[0].episodes[0].total).toBe(99 + 5);
    expect(breakdowns[0].total_points).toBe(104);
    expect(total).toBe(104);
  });

  it("adds a new source when override category does not exist in episode", () => {
    const breakdowns: ContestantPointsSummary[] = [
      {
        contestant_id: "c01",
        total_points: 10,
        episodes: [
          {
            episode_id: 1,
            total: 10,
            is_captain: false,
            sources: [{ label: "Survival", points: 10 }],
          },
        ],
      },
    ];
    const rows: CategoryOverrideRow[] = [
      { contestant_id: "c01", episode_id: 1, category: "Episode rank bonus", points: 3 },
    ];
    const map = buildCategoryOverrideMap(rows);
    const total = applyCategoryOverridesToBreakdowns(breakdowns, map);
    const sources = breakdowns[0].episodes[0].sources;
    expect(sources).toHaveLength(2);
    expect(sources.some((s) => s.label === "Survival" && s.points === 10)).toBe(true);
    expect(sources.some((s) => s.label === "Episode rank bonus" && s.points === 3)).toBe(true);
    expect(breakdowns[0].episodes[0].total).toBe(13);
    expect(total).toBe(13);
  });

  it("applies overrides per (contestant_id, episode_id) and recomputes contestant total", () => {
    const breakdowns: ContestantPointsSummary[] = [
      {
        contestant_id: "c01",
        total_points: 20,
        episodes: [
          {
            episode_id: 1,
            total: 10,
            is_captain: false,
            sources: [{ label: "Survival", points: 10 }],
          },
          {
            episode_id: 2,
            total: 10,
            is_captain: false,
            sources: [{ label: "Survival", points: 10 }],
          },
        ],
      },
    ];
    const rows: CategoryOverrideRow[] = [
      { contestant_id: "c01", episode_id: 1, category: "Survival", points: 0 },
    ];
    const map = buildCategoryOverrideMap(rows);
    const total = applyCategoryOverridesToBreakdowns(breakdowns, map);
    expect(breakdowns[0].episodes[0].total).toBe(0);
    expect(breakdowns[0].episodes[1].total).toBe(10);
    expect(breakdowns[0].total_points).toBe(10);
    expect(total).toBe(10);
  });
});
