import Link from "next/link";

function BPSTable({ title, rows }: { title: string; rows: { event: string; condition: string; points: string }[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-orange-400">{title}</h3>
      <div className="rounded-lg overflow-hidden stone-outline">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-700/50 text-stone-200/90">
              <th className="text-left px-4 py-2.5 font-semibold">Event</th>
              <th className="text-left px-4 py-2.5 font-semibold">Condition</th>
              <th className="text-right px-4 py-2.5 font-semibold">Impact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-stone-600/30 bg-stone-800/30">
                <td className="px-4 py-2 text-stone-200">{r.event}</td>
                <td className="px-4 py-2 text-stone-400 text-xs">{r.condition}</td>
                <td className="px-4 py-2 text-right text-stone-100 font-medium">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BonusPointsPage() {
  return (
    <div className="space-y-10">
      <div>
        <Link href="/rules" className="text-sm text-orange-400 hover:text-orange-300 mb-4 inline-block">
          ← Back to Rules
        </Link>
        <h1 className="text-2xl font-bold text-stone-100">Episode Impact Bonus System (BPS)</h1>
      </div>

      <section className="space-y-3">
        <p className="text-sm text-stone-300">
          Each episode, every contestant is scored across four impact categories. The <strong className="text-stone-100">top 3 performers</strong> earn bonus points that are added to the main scoring system. Social and strategic impact is the primary signal — challenge and visibility serve as supporting factors.
        </p>
      </section>

      {/* Social & Strategic */}
      <BPSTable
        title="A) Social & Strategic Impact (Primary Signal)"
        rows={[
          { event: "Named inclusion in plan", condition: "Plan succeeds or player survives", points: "+3" },
          { event: "Explicit safety statement", condition: "Player receives 0 votes", points: "+3" },
          { event: "Receives correct vote info", condition: "Matches vote outcome", points: "+3" },
          { event: "Receives correct advantage info", condition: "Advantage exists", points: "+3" },
          { event: "Initiates strategic conversation", condition: "—", points: "+2" },
          { event: "Receives kept commitment", condition: "Commitment honored", points: "+4" },
          { event: "Explicit swing label", condition: "Vote hinges on player", points: "+5" },
          { event: "Named target but survives", condition: "Player survives", points: "+5" },
        ]}
      />

      {/* Advantage & Risk */}
      <BPSTable
        title="B) Advantage & Risk Impact (Secondary)"
        rows={[
          { event: "Clue found", condition: "—", points: "+1" },
          { event: "Advantage or idol found", condition: "Exists", points: "+2" },
          { event: "Advantage or idol played", condition: "Affects outcome", points: "+3" },
          { event: "Idol nullifies votes", condition: "Per vote negated", points: "+2" },
          { event: "Holds idol through Tribal", condition: "Survives", points: "+1" },
          { event: "Failed idol play", condition: "—", points: "-1" },
        ]}
      />

      {/* Challenge */}
      <BPSTable
        title="C) Challenge Impact (Tertiary)"
        rows={[
          { event: "Wins team immunity", condition: "—", points: "+1" },
          { event: "Wins individual immunity", condition: "—", points: "+2" },
          { event: "Key contributor (verbal credit)", condition: "Team wins", points: "+1" },
          { event: "Costs tribe challenge", condition: "Team loses", points: "-1" },
        ]}
      />

      {/* Visibility */}
      <BPSTable
        title="D) Visibility & Narrative (Tie-Break Signal)"
        rows={[
          { event: "4–6 confessionals", condition: "—", points: "+1" },
          { event: "7+ confessionals", condition: "—", points: "+2" },
          { event: "Episode narrator", condition: "Most confessionals", points: "+2" },
        ]}
      />

      {/* Rank Bonus */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">Episode Rank Bonus</h2>
        <p className="text-sm text-stone-300">
          After calculating each contestant&apos;s BPS impact score for the episode, the top 3 receive bonus points added to the main scoring system:
        </p>
        <div className="flex gap-8 mt-3 justify-center">
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400">+3</div>
            <div className="text-sm text-stone-400 mt-1">1st Place</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-stone-200">+2</div>
            <div className="text-sm text-stone-400 mt-1">2nd Place</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-stone-500">+1</div>
            <div className="text-sm text-stone-400 mt-1">3rd Place</div>
          </div>
        </div>
      </section>

      {/* Tie Handling */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">Tie Handling</h2>
        <div className="text-sm text-stone-300 space-y-2">
          <p>If two or more contestants tie in BPS score:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tied contestants all receive the <strong className="text-stone-100">higher bonus</strong>.</li>
            <li>The next rank is <strong className="text-stone-100">skipped</strong>.</li>
          </ul>
          <p className="text-xs text-stone-400 mt-2">
            Example: If two contestants tie for 1st, both receive +3. The next bonus awarded is +1 (2nd place is skipped).
          </p>
        </div>
      </section>

      <div className="pt-4">
        <Link href="/rules" className="text-sm text-orange-400 hover:text-orange-300">
          ← Back to Rules
        </Link>
      </div>
    </div>
  );
}
