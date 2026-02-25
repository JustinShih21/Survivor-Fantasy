/**
 * First episode airtime for Season 50.
 * Override with NEXT_PUBLIC_FIRST_EPISODE_AIRTIME (ISO 8601 string) if needed.
 * When unset, defaults to tomorrow at 8pm Eastern (America/New_York).
 */
function getDefaultFirstEpisodeAirtime(): Date {
  const envAirtime = typeof process.env.NEXT_PUBLIC_FIRST_EPISODE_AIRTIME === "string"
    ? process.env.NEXT_PUBLIC_FIRST_EPISODE_AIRTIME
    : null;
  if (envAirtime) return new Date(envAirtime);

  const now = new Date();
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = f.formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const tomorrow = new Date(y, m - 1, d + 1);
  const y2 = tomorrow.getFullYear();
  const m2 = tomorrow.getMonth();
  const d2 = tomorrow.getDate();
  // 8pm Eastern = 01:00 UTC next calendar day (EST)
  return new Date(Date.UTC(y2, m2, d2 + 1, 1, 0, 0, 0));
}

export const FIRST_EPISODE_AIRTIME: Date = getDefaultFirstEpisodeAirtime();
