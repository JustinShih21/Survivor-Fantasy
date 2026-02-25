import type { ContestantPointsSummary } from "./scoring";

export interface CategoryOverrideRow {
  contestant_id: string;
  episode_id: number;
  category: string;
  points: number;
}

/**
 * Builds a map from "contestant_id:episode_id" to Map<category, points> from override rows.
 */
export function buildCategoryOverrideMap(
  rows: CategoryOverrideRow[]
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = `${row.contestant_id}:${row.episode_id}`;
    let m = map.get(key);
    if (!m) {
      m = new Map();
      map.set(key, m);
    }
    m.set(row.category, row.points);
  }
  return map;
}

/**
 * Applies category overrides to contestant_breakdowns in place: for each episode,
 * replace or add source points from the override map, recompute episode total
 * and contestant total. Returns the new grand total.
 */
export function applyCategoryOverridesToBreakdowns(
  contestant_breakdowns: ContestantPointsSummary[],
  overrideMap: Map<string, Map<string, number>>
): number {
  let newTotal = 0;
  for (const b of contestant_breakdowns) {
    let breakdownTotal = 0;
    for (const ep of b.episodes) {
      const key = `${b.contestant_id}:${ep.episode_id}`;
      const overrides = overrideMap.get(key);
      const labelToPoints = new Map<string, number>();
      for (const s of ep.sources) {
        const pts = overrides?.has(s.label) ? (overrides.get(s.label) ?? 0) : s.points;
        labelToPoints.set(s.label, pts);
      }
      if (overrides) {
        for (const [cat, pts] of overrides) {
          if (!labelToPoints.has(cat)) labelToPoints.set(cat, pts);
        }
      }
      ep.sources = Array.from(labelToPoints.entries()).map(([label, points]) => ({ label, points }));
      ep.total = ep.sources.reduce((sum, s) => sum + s.points, 0);
      breakdownTotal += ep.total;
    }
    b.total_points = breakdownTotal;
    newTotal += breakdownTotal;
  }
  return newTotal;
}
