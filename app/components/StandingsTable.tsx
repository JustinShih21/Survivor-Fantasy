"use client";

export interface Standing {
  user_id: string;
  tribe_name: string;
  first_name: string;
  last_name: string;
  total_points: number;
}

/** FPL-style standings table: Rank, Manager (tribe + name), Points; current user highlighted. */
export function StandingsTable({
  standings,
  currentUserId,
}: {
  standings: Standing[];
  currentUserId: string;
}) {
  return (
    <div className="rounded-lg overflow-hidden stone-outline">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-700/50 text-stone-200/90">
            <th className="text-left px-3 py-2.5 font-semibold w-10">#</th>
            <th className="text-left px-3 py-2.5 font-semibold">Manager</th>
            <th className="text-right px-3 py-2.5 font-semibold tabular-nums">Points</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const isYou = s.user_id === currentUserId;
            return (
              <tr
                key={s.user_id}
                className={`border-t border-stone-600/50 ${isYou ? "bg-orange-900/25" : "bg-stone-800/30"}`}
              >
                <td className="px-3 py-2.5 text-stone-300 tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="text-stone-100 font-medium">{s.tribe_name || "—"}</div>
                      <div className="text-stone-400 text-xs">
                        {[s.first_name, s.last_name].filter(Boolean).join(" ") || "—"}
                      </div>
                    </div>
                    {isYou && (
                      <span className="shrink-0 rounded bg-orange-600/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-stone-950">
                        You
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-orange-400 tabular-nums">
                  {s.total_points} pts
                </td>
              </tr>
            );
          })}
          {standings.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-stone-400">
                No members with teams yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
