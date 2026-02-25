import Link from "next/link";

function ScoringTable() {
  const rows = [
    { category: "Survival", event: "Survive Tribal Council (pre-merge)", points: "+1 per tribal" },
    { category: "", event: "Survive post-merge episode", points: "+3" },
    { category: "", event: "Reach Final Tribal (Final 3)", points: "+6" },
    { category: "", event: "Win the season", points: "+10" },
    { category: "Team Challenges", event: "Win team immunity (1st place)", points: "+2" },
    { category: "", event: "2nd place (3-team or 2-team)", points: "+1" },
    { category: "", event: "Last place (losing tribe)", points: "-1" },
    { category: "", event: "Win team reward (1st place)", points: "+1" },
    { category: "Individual", event: "Win individual immunity", points: "+6" },
    { category: "Tribal Council", event: "Vote with the majority", points: "+2" },
    { category: "", event: "Correct target vote", points: "+1" },
    { category: "", event: "Zero votes received at tribal", points: "+1" },
    { category: "", event: "Voted out", points: "-1 per vote × 2^(items)" },
    { category: "Confessionals", event: "4–6 confessionals in episode", points: "+2" },
    { category: "", event: "7+ confessionals in episode", points: "+4" },
    { category: "Advantages", event: "Clue read", points: "+2" },
    { category: "", event: "Advantage played", points: "+5" },
    { category: "", event: "Idol played (per vote nullified)", points: "+2" },
    { category: "", event: "Idol played (failed)", points: "-2" },
    { category: "Other", event: "Transfer add penalty", points: "-5 per add" },
    { category: "", event: "Quit", points: "-10" },
  ];

  return (
    <div className="rounded-lg overflow-hidden stone-outline">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-700/50 text-stone-200/90">
            <th className="text-left px-4 py-3 font-semibold">Category</th>
            <th className="text-left px-4 py-3 font-semibold">Event</th>
            <th className="text-right px-4 py-3 font-semibold">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-stone-600/30 bg-stone-800/30">
              <td className="px-4 py-2.5 text-orange-400 font-medium whitespace-nowrap">{r.category}</td>
              <td className="px-4 py-2.5 text-stone-200">{r.event}</td>
              <td className="px-4 py-2.5 text-right text-stone-100 font-medium whitespace-nowrap">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RulesPage() {
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold text-stone-100">Rules &amp; How to Play</h1>

      {/* How to Build Your Team */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">How to Build Your Team</h2>
        <div className="text-sm text-stone-300 space-y-2">
          <p>Build your <strong className="text-stone-100">Tribe</strong> by selecting 7 contestants from the Survivor 50 cast. Your tribe is your fantasy team — it&apos;s used across all leagues and the global leaderboard.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You have a <strong className="text-stone-100">$1,000,000 salary cap</strong>. Each contestant has a price — your team&apos;s total cost must stay under budget.</li>
            <li>You must select at least <strong className="text-stone-100">1 contestant from each starting tribe</strong> (Cila, Kalo, and Vatu).</li>
            <li>Once you create your tribe, it&apos;s locked in. You can make changes later through the transfer system.</li>
          </ul>
        </div>
      </section>

      {/* Scoring System */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">Scoring System</h2>
        <p className="text-sm text-stone-300">Points are earned based on real Survivor episode events. Here&apos;s the full breakdown:</p>
        <ScoringTable />
        <p className="text-xs text-stone-400">
          Tribal Council points (vote matched, zero votes, strategic player) are only awarded if the contestant attended tribal (their tribe lost immunity). Post-merge: everyone attends.
        </p>
      </section>

      {/* Captain System */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">Captain System</h2>
        <div className="text-sm text-stone-300 space-y-2">
          <p>Before each episode, select one player on your roster as <strong className="text-stone-100">Captain</strong>.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your captain&apos;s points are <strong className="text-orange-400">doubled (2×)</strong> for that episode.</li>
            <li>Choose wisely — pick the player you think will have the biggest episode.</li>
            <li>You can change your captain on the <strong className="text-stone-100">Pick Team</strong> page by dragging a roster player to the captain slot.</li>
          </ul>
        </div>
      </section>

      {/* Bonus Points */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">Episode Impact Bonus Points</h2>
        <div className="text-sm text-stone-300 space-y-2">
          <p>Each episode, all contestants are scored on their <strong className="text-stone-100">social, strategic, challenge, and visibility impact</strong>. The top 3 performers earn bonus points:</p>
          <div className="flex gap-6 mt-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">+3</div>
              <div className="text-xs text-stone-400">1st place</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-stone-200">+2</div>
              <div className="text-xs text-stone-400">2nd place</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-stone-400">+1</div>
              <div className="text-xs text-stone-400">3rd place</div>
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-1">Ties receive the higher bonus; the next rank is skipped.</p>
        </div>
        <Link
          href="/rules/bonus-points"
          className="inline-block text-sm text-orange-400 hover:text-orange-300 transition-colors mt-1"
        >
          Learn more about how Bonus Points are scored →
        </Link>
      </section>

      {/* Transfers & Pricing */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">Transfers &amp; Pricing</h2>
        <div className="text-sm text-stone-300 space-y-2">
          <p>After each episode, you can <strong className="text-stone-100">sell</strong> players from your team and <strong className="text-stone-100">add</strong> new ones from the available pool.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-stone-100">Selling</strong> has no penalty. You receive the player&apos;s current market price back into your budget.</li>
            <li><strong className="text-stone-100">Adding</strong> a player costs their current price from your budget, plus a <strong className="text-red-400">-5 point penalty</strong> per add.</li>
            <li>You must sell and add <strong className="text-stone-100">equal numbers</strong> of players (1-for-1 swaps). Multiple swaps can be done at once.</li>
            <li>Points earned by a player while on your team are <strong className="text-stone-100">permanent</strong> — they don&apos;t disappear if you transfer them out.</li>
          </ul>
          <p className="mt-2"><strong className="text-stone-100">Dynamic pricing:</strong> Contestant prices adjust after each episode based on performance.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Prices change by <strong className="text-stone-100">±3%</strong> per episode based on how the player performed relative to the field.</li>
            <li>Price floor: <strong className="text-stone-100">$50,000</strong> / Price ceiling: <strong className="text-stone-100">$300,000</strong>.</li>
            <li><strong className="text-stone-100">Eliminated players:</strong> price is frozen at their last value. They cannot be bought but can still be sold.</li>
          </ul>
        </div>
      </section>

      {/* Leagues */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">Leagues</h2>
        <div className="text-sm text-stone-300 space-y-2">
          <p>Compete against friends by creating or joining <strong className="text-stone-100">private leagues</strong>.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-stone-100">Create a league</strong> and share the 6-character invite code with friends.</li>
            <li><strong className="text-stone-100">Join a league</strong> by entering an invite code or clicking a shared link.</li>
            <li>There&apos;s no limit on league size or the number of leagues you can join.</li>
            <li>Once you join a league, you cannot leave.</li>
            <li>Your tribe is the same across all leagues — one team, multiple competitions.</li>
          </ul>
          <p className="mt-2">Everyone is automatically included in the <strong className="text-orange-400">Global Leaderboard</strong>, which ranks all players by total points.</p>
        </div>
      </section>

      {/* How Points Work */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">How Points Work</h2>
        <div className="text-sm text-stone-300 space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            <li>Points are calculated <strong className="text-stone-100">episode by episode</strong> and accumulate over the full season.</li>
            <li>Your team&apos;s weekly score = sum of all roster players&apos; points, with the captain&apos;s score doubled.</li>
            <li>Points earned by a player while on your team are <strong className="text-stone-100">permanent</strong> — even after you transfer them out.</li>
            <li>For transferred-in players, only points scored <strong className="text-stone-100">while on your team</strong> count.</li>
            <li>Pre-merge points carry over into the post-merge phase. Final standings = total points across the entire season.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
