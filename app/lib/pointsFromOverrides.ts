/**
 * Helpers for point materialization: map point_category_overrides rows for use by
 * materializePoints when writing to contestant_episode_points.
 */

export type OverrideRow = {
  contestant_id: string;
  episode_id: number;
  category: string;
  points: number;
};

/** Build map: contestant_id:episode_id -> category -> points */
export function buildOverrideMap(
  rows: OverrideRow[]
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
