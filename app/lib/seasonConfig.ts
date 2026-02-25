const LA = "America/Los_Angeles";

/**
 * Returns the UTC Date for a given calendar day at 8pm in America/Los_Angeles.
 * Uses PST (-8) or PDT (-7) by testing which UTC hour maps to 20:00 in LA.
 */
function dateAt8pmPST(year: number, month: number, day: number): Date {
  const month0 = month - 1;
  // 8pm PST = 04:00 UTC next day; 8pm PDT = 03:00 UTC next day
  const candidatePST = new Date(Date.UTC(year, month0, day + 1, 4, 0, 0, 0));
  const candidatePDT = new Date(Date.UTC(year, month0, day + 1, 3, 0, 0, 0));
  const hourPST = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: LA, hour: "numeric", hour12: false }).format(candidatePST),
    10
  );
  const hourPDT = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: LA, hour: "numeric", hour12: false }).format(candidatePDT),
    10
  );
  if (hourPST === 20) return candidatePST;
  if (hourPDT === 20) return candidatePDT;
  return candidatePST;
}

/**
 * First episode airtime for Season 50.
 * Override with NEXT_PUBLIC_FIRST_EPISODE_AIRTIME (ISO 8601 string) if needed.
 * When unset, defaults to the next 8pm PST (today or tomorrow).
 */
function getDefaultFirstEpisodeAirtime(): Date {
  const envAirtime =
    typeof process.env.NEXT_PUBLIC_FIRST_EPISODE_AIRTIME === "string"
      ? process.env.NEXT_PUBLIC_FIRST_EPISODE_AIRTIME
      : null;
  if (envAirtime) return new Date(envAirtime);

  const now = new Date();
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: LA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = f.formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  const today8pm = dateAt8pmPST(y, m, d);
  if (now.getTime() < today8pm.getTime()) return today8pm;

  const tomorrow = new Date(y, m - 1, d + 1);
  const y2 = tomorrow.getFullYear();
  const m2 = tomorrow.getMonth() + 1;
  const d2 = tomorrow.getDate();
  return dateAt8pmPST(y2, m2, d2);
}

export const FIRST_EPISODE_AIRTIME: Date = getDefaultFirstEpisodeAirtime();
