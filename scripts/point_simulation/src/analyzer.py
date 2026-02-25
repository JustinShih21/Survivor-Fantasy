"""
Analyzes simulation results and generates detailed reports.
"""

from typing import Dict, List, Any
from collections import defaultdict


# Human-readable labels for event types
EVENT_LABELS = {
    "survival_pre_merge": "Survival (pre-merge, +2 per episode)",
    "survival_post_merge": "Survival (post-merge, +3 per episode)",
    "survival_swap": "Survival (swap phase, +2 per episode)",
    "team_immunity_first": "Team immunity 1st place (+3)",
    "team_immunity_second_three": "Team immunity 2nd place, 3-team (+1)",
    "team_immunity_second_two": "Team immunity 2nd place, 2-team (+0)",
    "team_immunity_last": "Team immunity 3rd/last (-1)",
    "team_reward_first": "Team reward 1st place (+2)",
    "team_reward_second_three": "Team reward 2nd place, 3-team (+1)",
    "team_reward_second_two": "Team reward 2nd place, 2-team (+0)",
    "individual_immunity": "Individual immunity win (+5)",
    "vote_matched": "Vote matched person voted out (+2)",
    "voted_out": "Voted out (base -4 × 2^pocket + -1 per vote)",
    "clue_read": "First to read clue (+1)",
    "advantage_play": "Successful advantage play (+4)",
    "idol_play": "Successful immunity idol play (+7)",
    "idol_failure": "Idol played incorrectly (-2)",
    "strategic_player": "Strategic player of episode (+4)",
    "final_tribal": "Reach final tribal (+5)",
    "win_season": "Win season (+9)",
    "quit": "Quit (-10)",
}


def analyze_results(
    results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Analyze simulation results with granular event-level stats.
    results: List of { roster, strategy, total, breakdown, event_breakdown, scenario_id } per run
    """
    strategy_scores = defaultdict(list)
    all_totals = []
    all_breakdowns = defaultdict(list)
    
    # Aggregate event-level: total count and total points across ALL runs
    event_totals = defaultdict(lambda: {"count": 0, "points": 0})
    
    for r in results:
        strategy_scores[r["strategy"]].append(r["total"])
        all_totals.append(r["total"])
        
        for cat, val in r["breakdown"].items():
            all_breakdowns[cat].append(val)
        
        # Sum event-level stats
        for event_type, data in r.get("event_breakdown", {}).items():
            event_totals[event_type]["count"] += data.get("count", 0)
            event_totals[event_type]["points"] += data.get("points", 0)
    
    total_avg = sum(all_totals) / len(all_totals) if all_totals else 0
    total_points_all_runs = sum(all_totals)
    
    category_pct = {}
    category_avg = {}
    for cat, vals in all_breakdowns.items():
        avg = sum(vals) / len(vals) if vals else 0
        category_avg[cat] = avg
        category_pct[cat] = (avg / total_avg * 100) if total_avg != 0 else 0
    
    # Event-level percentage of total points
    event_pct = {}
    for event_type, data in event_totals.items():
        pct = (data["points"] / total_points_all_runs * 100) if total_points_all_runs != 0 else 0
        event_pct[event_type] = pct
    
    strategy_stats = {}
    for strat, scores in strategy_scores.items():
        if scores:
            strategy_stats[strat] = {
                "mean": sum(scores) / len(scores),
                "min": min(scores),
                "max": max(scores),
                "count": len(scores),
            }
    
    sorted_totals = sorted(all_totals)
    n = len(sorted_totals)
    percentiles = {
        "p10": sorted_totals[int(n * 0.1)] if n > 0 else 0,
        "p25": sorted_totals[int(n * 0.25)] if n > 0 else 0,
        "p50": sorted_totals[int(n * 0.5)] if n > 0 else 0,
        "p75": sorted_totals[int(n * 0.75)] if n > 0 else 0,
        "p90": sorted_totals[int(n * 0.9)] if n > 0 else 0,
    }
    
    # Sample 3 example results for detailed breakdown (high, median, low)
    examples = []
    if results:
        sorted_results = sorted(results, key=lambda x: x["total"])
        for i, idx in enumerate([0, len(sorted_results) // 2, len(sorted_results) - 1]):
            r = sorted_results[idx]
            label = ["Lowest", "Median", "Highest"][i]
            examples.append({
                "label": label,
                "total": r["total"],
                "strategy": r["strategy"],
                "scenario_id": r["scenario_id"],
                "event_breakdown": r.get("event_breakdown", {}),
            })
    
    return {
        "total_runs": len(results),
        "total_avg": total_avg,
        "total_points_all_runs": total_points_all_runs,
        "category_avg": category_avg,
        "category_pct": category_pct,
        "event_totals": dict(event_totals),
        "event_pct": event_pct,
        "strategy_stats": strategy_stats,
        "percentiles": percentiles,
        "examples": examples,
        "all_totals": all_totals,
    }


def _get_methodology_section() -> str:
    """Return detailed methodology explanation for report."""
    return """
## How the Simulation Works

This section explains the exact rules of each simulated game so you can verify the simulation is correct.

### Overview

- **Monte Carlo simulation:** Each "run" generates one random season scenario. The same set of team rosters is then scored against that scenario. Total team-scenario pairs = (scenario runs) × (rosters per run) × (strategies).
- **One scenario = one full season:** Boot order, challenge winners, idol finds/plays, etc. are determined once per scenario and stay fixed for all teams.
- **One roster = one team:** Each team has a fixed 7-contestant roster. The same roster is scored against every scenario.

---

### Roster Rules (Team Construction)

| Rule | Implementation |
|------|-----------------|
| **Roster size** | 7 contestants |
| **Tribe constraint** | 2 contestants from each of 3 starting tribes (Tribe A, B, C) |
| **Wild card** | 1 additional contestant from any tribe |
| **No replacement** | When a roster member is voted out, they are NOT replaced. The same 7 players are used for the entire season. |
| **No merge repick** | There is no post-merge roster rebuild. The 7 pre-merge picks are the only picks. |

**Roster strategies tested:** `random`, `challenge_beast` (prioritize high challenge_ability), `idol_hunter` (prioritize high idol_likelihood), `utr` (prioritize high survival_bias), `balanced` (same as random).

---

### Contestant Pool

- **24 contestants** total
- **3 starting tribes:** Tribe A (1–8), Tribe B (9–16), Tribe C (17–24)
- **Each contestant has traits:** `challenge_ability`, `idol_likelihood`, `survival_bias` (0–1 scale). These bias random outcomes.

---

### Season Structure (Dynamic)

| Phase | When | Tribes | Immunity | Reward |
|-------|------|--------|----------|--------|
| Pre-merge | Start until swap | 3 tribes | Team (3) | Team (3) |
| Swap | 16 or 17 players left (50% each) | 2 tribes (random) | Team (2) | Team (2) |
| Merge | 12 or 11 players left (50% each) | 1 tribe | Individual | Individual |
| Finale | 3 remain | — | — | No (FTC only) |

- **Tribe swap:** After 7 or 8 eliminations (50% chance each), remaining players are randomly split into 2 tribes.
- **Full merge:** After 4–6 more eliminations (depending on swap point), all remaining players merge into 1 tribe.
- **Total eliminations:** 21 (24 → 3). Episode count varies by swap/merge timing.

---

### Scenario Generation Rules (Per Season)

#### Boot Order
- **Determined once per scenario** using weighted random: each contestant's `survival_bias` (0–1) is their weight.
- **Order is fixed:** First in boot order = episode 1 vote-out, etc. 21 eliminations total (24 → 3).

#### Team Immunity
- **3 tribes (pre-merge):** 1st = +3, 2nd = +1, 3rd = -1
- **2 tribes (swap phase):** 1st = +3, 2nd = +0

#### Team Reward
- **3 tribes:** 1st = +2, 2nd = +1, 3rd = 0
- **2 tribes:** 1st = +2, 2nd = +0

#### Individual Immunity (Post-merge)
- **One winner per episode.** Weighted random using `challenge_ability`. **Winner gets +5.**

#### Vote Matched
- When someone is voted out, a random **65–95%** of the remaining (non-eliminated) players are designated as having voted for that person (on the "right side" of the vote).
- Each of those players gets +2.

#### Voted Out
- **Base penalty:** -4
- **Pocket multiplier:** If the voted-out player had an idol/advantage in pocket, penalty = -4 × 2^(number of items). 1 item = -8, 2 items = -16.
- **Per-vote penalty:** -1 × (votes received). Votes received: random 4–6 pre-merge, 5–9 post-merge.
- **Total:** -4 × 2^pocket + (-1 × votes)

#### Idol Finds
- **3–6 idols found per season** (random, more variability)
- **Random episodes** (from episodes with tribals)
- **Random finders** (contestants who find them)

#### Idol Plays (Success + Failure)
- **Each idol find** can be played at a later tribal. **~55% success rate** per play.
- **Success:** +7 points. **Failure** (played incorrectly): **-2 points**.
- **Must occur after the find.** Only counted when there is a tribal that episode.

#### Clue Reads
- **1–4 clue-read events per season**
- **1–2 readers per clue** (can be shared)
- **Random episodes, random readers**

#### Advantage Plays (non-idol)
- **0–2 successful plays per season**
- **Random episode, random player**

#### Strategic Player of the Episode (+4)
- **Replaces fake idol trick.** Each tribal where someone is voted out, one person from the `vote_matched` list is designated the **strategic driver** (the person who led the vote).
- **Selection:** Random choice **weighted by `survival_bias`** (higher = more likely to be chosen).
- **Points:** +4 to that player.

#### Voted Out with Idol in Pocket
- **17% chance** when someone is voted out that they had 1+ items in pocket
- **3% chance** (given they have an item) that they had 2 items

#### Quit / Medevac
- **Not implemented** in current simulation (quit probability ~0.02, medevac ~0.05—too rare to appear in 100 runs).

---

### Point Values (from config/scoring.yaml)

| Event | Points |
|-------|--------|
| Survival (pre-merge, swap) | +2 |
| Survival (post-merge) | +3 |
| Team immunity 1st | +3 |
| Team immunity 2nd (3 tribes) | +1 |
| Team immunity 2nd (2 tribes) | +0 |
| Team immunity 3rd/last | -1 |
| Team reward 1st | +2 |
| Team reward 2nd (3 tribes) | +1 |
| Team reward 2nd (2 tribes) | +0 |
| Individual immunity | +5 |
| Vote matched | +2 |
| Voted out (base) | -4 |
| Voted out (per vote) | -1 × votes |
| Voted out (pocket) | base × 2^items |
| Clue read | +1 |
| Advantage play | +4 |
| Idol play (success) | +7 |
| Idol play (failure) | -2 |
| Strategic player of episode | +4 |
| Final tribal (top 3) | +5 |
| Win season | +9 |
| Quit | -10 |

---

### Scoring Logic (How Points Are Assigned to a Team)

For each team roster and each episode:

1. **Only roster members still in the game** earn positive points (survival, challenges, vote matched, advantages). Eliminated roster members earn nothing from that point on.
2. **Voted out:** If a roster member is voted out this episode, the penalty is applied: `-4 × 2^pocket_items + (-1 × votes_received)`.
3. **Survival:** Each roster member in `survived` (attended tribal and was not voted out) gets +2 (pre-merge) or +3 (post-merge). Survival is only awarded when a tribal occurred and someone was voted out.
4. **Challenges:** Each roster member on the winning/losing tribe gets the corresponding team immunity/reward points. Individual immunity winner gets +5.
5. **Vote matched:** Each roster member in the `vote_matched` list gets +2.
6. **Advantages:** Clue readers (+1), idol players (+7), idol failures (-2), advantage players (+4), strategic player (+4).
7. **Placement:** At finale, roster members in final 3 get +5 each; winner gets +9.

---

### What to Verify

- **Eliminations:** 21 tribals with votes (24 → 3). Final three is randomly chosen from the last 3; winner from those 3.
- **Survival:** Pre-merge + swap: +2 per survivor per tribal. Post-merge: +3 per survivor.
- **Team challenges:** 3 tribes (pre-merge) or 2 tribes (swap phase): each tribe gets one placement per episode.
- **Individual immunity:** Exactly one winner per post-merge episode.
"""


def generate_report(analysis: Dict[str, Any]) -> str:
    """Generate detailed markdown report."""
    n_teams = analysis["total_runs"]
    total_pts = analysis.get("total_points_all_runs", 1)
    event_totals = analysis.get("event_totals", {})
    event_pct = analysis.get("event_pct", {})
    
    lines = [
        "# Survivor Fantasy Point Simulation Report",
        "",
        "## Simulation Parameters",
        "",
        f"- **Total team-scenario pairs:** {n_teams:,}",
        f"- **Average team score:** {analysis['total_avg']:.1f}",
        f"- **Total points across all runs:** {total_pts:,.0f}",
        "",
        "### Important: No Player Replacement",
        "",
        "This simulation uses **fixed rosters with no replacement**. Each team selects 7 contestants at the start (pre-merge). When a contestant is voted out, they are **not replaced**—the same 7 players are scored for the entire season. Eliminated players stop earning points (no survival, challenges, or tribal) but can still incur penalties (voted out). There is no merge repick in this simulation.",
        "",
        _get_methodology_section(),
        "",
        "---",
        "",
        "## Every Point Feature: Count, Avg per Team, Total Points, % of Total",
        "",
        "| Event Type | Total Occurrences | Avg per Team | Total Points | % of All Points |",
        "|------------|-------------------|--------------|--------------|-----------------|",
    ]
    
    for event_type in EVENT_LABELS:
        data = event_totals.get(event_type, {"count": 0, "points": 0})
        pct = event_pct.get(event_type, 0)
        avg_per_team = data["count"] / n_teams if n_teams > 0 else 0
        lines.append(f"| {EVENT_LABELS[event_type]} | {data['count']:,} | {avg_per_team:.1f} | {data['points']:,.0f} | {pct:.2f}% |")
    
    lines.extend([
        "",
        "---",
        "",
        "## Example Team Breakdowns",
        "",
        "Three sample team-scenario results showing how points break down by event type.",
        "",
    ])
    
    for ex in analysis.get("examples", []):
        lines.append(f"### Example: {ex['label']} Scoring Team (Total: {ex['total']} points)")
        lines.append("")
        lines.append(f"- **Strategy:** {ex['strategy']}")
        lines.append(f"- **Scenario ID:** {ex['scenario_id']}")
        lines.append("")
        lines.append("| Event Type | Count | Points |")
        lines.append("|------------|-------|--------|")
        
        eb = ex.get("event_breakdown", {})
        for event_type in EVENT_LABELS:
            data = eb.get(event_type, {"count": 0, "points": 0})
            if data["count"] > 0 or data["points"] != 0:
                lines.append(f"| {EVENT_LABELS[event_type]} | {data['count']} | {data['points']} |")
        lines.append("")
    
    lines.extend([
        "---",
        "",
        "## Category Summary",
        "",
        "| Category | Avg Points | % of Total |",
        "|----------|------------|------------|",
    ])
    
    for cat, pct in analysis["category_pct"].items():
        avg = analysis["category_avg"].get(cat, 0)
        lines.append(f"| {cat} | {avg:.1f} | {pct:.1f}% |")
    
    lines.extend([
        "",
        "## Point Distribution (Percentiles)",
        "",
        "| Percentile | Points |",
        "|------------|--------|",
        f"| 10th | {analysis['percentiles']['p10']:.0f} |",
        f"| 25th | {analysis['percentiles']['p25']:.0f} |",
        f"| 50th (median) | {analysis['percentiles']['p50']:.0f} |",
        f"| 75th | {analysis['percentiles']['p75']:.0f} |",
        f"| 90th | {analysis['percentiles']['p90']:.0f} |",
        "",
        "## Strategy Comparison",
        "",
        "| Strategy | Avg Score | Min | Max | Count |",
        "|----------|-----------|-----|-----|-------|",
    ])
    
    for strat, stats in analysis["strategy_stats"].items():
        lines.append(f"| {strat} | {stats['mean']:.1f} | {stats['min']:.0f} | {stats['max']:.0f} | {stats['count']:,} |")
    
    lines.extend([
        "",
        "## Balance Notes",
        "",
    ])
    
    survival_pct = analysis["category_pct"].get("survival", 0)
    lines.append(f"- **Survival:** {survival_pct:.1f}% of points. Core floor.")
    
    challenges_pct = analysis["category_pct"].get("challenges", 0)
    lines.append(f"- **Challenges:** {challenges_pct:.1f}% of points. Team + individual immunity/reward.")
    
    penalties_avg = analysis["category_avg"].get("penalties", 0)
    lines.append(f"- **Penalties:** Avg {penalties_avg:.1f} per team. Voted-out penalty creates downside.")
    
    adv_pct = analysis["category_pct"].get("advantages", 0)
    lines.append(f"- **Advantages:** {adv_pct:.1f}% of points. Idol/advantage events are rare by design.")
    
    return "\n".join(lines)
