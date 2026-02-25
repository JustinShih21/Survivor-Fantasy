#!/usr/bin/env python3
"""
Full-Stack Simulation: Points, strategies, roster changes, price dynamics, captaincy.
Runs episode-by-episode with dynamic pricing, replacement logic, and captain selection.
Produces comprehensive report on point breakdowns, emerging strategies, and system behavior.

Transfer mechanics: Sell = no penalty; Add = configurable penalty (default -10) per add.
"""

import sys
import json
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent))

import yaml

from src.point_calculator import calculate_roster_points
from src.scenario_generator import generate_scenario
from src.price_generator import (
    compute_expected_points_per_contestant,
    expected_points_to_prices,
)
from src.roster_generator import generate_budget_rosters_for_simulation
from src.dynamic_pricing import (
    update_prices_from_episode,
    count_viable_replacements,
    calculate_contestant_episode_points,
)


CAPTAIN_MULTIPLIER = 2.0


def load_config(config_dir: Path) -> tuple:
    with open(config_dir / "scoring.yaml") as f:
        scoring = yaml.safe_load(f)
    with open(config_dir / "season_template.yaml") as f:
        season = yaml.safe_load(f)
    with open(config_dir / "contestants_s50.yaml") as f:
        contestants = yaml.safe_load(f)["contestants"]
    with open(config_dir / "pricing.yaml") as f:
        pricing = yaml.safe_load(f)
    dynamic_path = config_dir / "dynamic_pricing.yaml"
    dynamic = {}
    if dynamic_path.exists():
        with open(dynamic_path) as f:
            dynamic = yaml.safe_load(f) or {}
    return scoring, season["episodes"], contestants, pricing, dynamic


def pick_captain(roster: list, expected_points: dict, ep_outcome: dict) -> str | None:
    """Pick captain for this episode: highest expected points among active roster members."""
    active = set(ep_outcome.get("active_contestants", []))
    voted_out = ep_outcome.get("voted_out")
    if voted_out:
        active.add(voted_out)
    candidates = [c for c in roster if c in active]
    if not candidates:
        return None
    return max(candidates, key=lambda c: expected_points.get(c, 0))


def run_full_simulation(
    num_scenarios: int = 100,
    rosters_per_strategy: int = 10,
    seed: int = 42,
    output_dir: Path = None,
) -> dict:
    config_dir = Path(__file__).parent / "config"
    scoring, season_template, contestants, pricing_config, dynamic_config = load_config(config_dir)
    budget = pricing_config.get("budget", 1_000_000)
    update_config = dict(pricing_config, **dynamic_config)
    add_player_penalty = scoring.get("other", {}).get("add_player_penalty", -10)

    print("Step 1: Computing expected points and prices...")
    expected_points = compute_expected_points_per_contestant(
        contestants, season_template, scoring, config_dir, num_runs=500, seed=seed
    )
    prices = expected_points_to_prices(expected_points, pricing_config)

    # Calibrate for target valid %
    from src.roster_enumerator import compute_combo_cost_percentiles, count_valid_rosters
    target_valid = pricing_config.get("target_valid_pct")
    if target_valid and target_valid < 1:
        percentiles = compute_combo_cost_percentiles(
            contestants, prices, roster_min=7, roster_max=7, percentiles=[target_valid]
        )
        target_cost = percentiles.get(f"p{int(target_valid*100)}", budget)
        increment = pricing_config.get("price_increment", 2500)
        price_min = pricing_config.get("price_min", 100000)
        price_max = pricing_config.get("price_max", 260000)
        if target_cost > 0:
            scale = budget / target_cost
            prices = {
                cid: int(max(price_min, min(price_max, round(p * scale / increment) * increment)))
                for cid, p in prices.items()
            }
        sorted_ids = sorted(prices.keys(), key=lambda x: prices[x], reverse=True)
        top7 = sum(prices[c] for c in sorted_ids[:7])
        if top7 <= budget:
            scale2 = (budget + increment) / top7 if top7 > 0 else 1.0
            prices = {
                cid: int(max(price_min, min(price_max, round(p * scale2 / increment) * increment)))
                for cid, p in prices.items()
            }

    print("Step 2: Generating rosters...")
    rosters = generate_budget_rosters_for_simulation(
        contestants, prices, budget, expected_points,
        num_per_strategy=rosters_per_strategy, seed=seed,
        roster_min=7, roster_max=7,
    )

    # Play styles: (replace_when_viable,) — captaincy is REQUIRED for all
    play_styles = [
        ("fixed", False),   # No replacement; captain required
        ("replace", True),  # Replace when viable; captain required
    ]

    print("Step 3: Running full-stack simulation...")
    results = []
    event_breakdown_agg = defaultdict(lambda: {"count": 0, "points": 0})
    captain_bonus_agg = 0.0
    replacement_count = 0
    replacement_penalty_agg = 0.0
    price_change_impact = []  # (ep_idx, price_delta_avg) per scenario

    for s in range(num_scenarios):
        scenario_seed = seed + s * 7777
        episode_outcomes = generate_scenario(
            contestants, season_template, seed=scenario_seed, config_dir=config_dir
        )

        # Build price history for this scenario (shared by all rosters)
        scenario_prices = dict(prices)
        price_history = [dict(scenario_prices)]
        for ep_idx, ep in enumerate(episode_outcomes):
            if ep.get("final_tribal"):
                break
            if ep.get("voted_out"):
                scenario_prices = update_prices_from_episode(
                    scenario_prices, ep, scoring, update_config,
                    episode_index=ep_idx, tribal_episode_count=ep_idx + 1,
                )
                price_history.append(dict(scenario_prices))

        for roster_data in rosters:
            roster = list(roster_data["roster"])
            strategy = roster_data["strategy"]

            for style_name, replace_when_viable in play_styles:
                working_roster = list(roster)
                captain_per_episode = []
                total_replacement_penalty = 0
                ph_idx = 0

                for ep_idx, ep in enumerate(episode_outcomes):
                    if ep.get("final_tribal"):
                        break

                    voted_out = ep.get("voted_out")
                    if voted_out and voted_out in working_roster:
                        # Use prices AFTER this episode's update for replacement check
                        prices_at_ep = price_history[min(ph_idx + 1, len(price_history) - 1)]
                        budget_freed = price_history[ph_idx].get(voted_out, 100000)
                        remaining = list(ep.get("active_contestants", []))
                        ep_remaining = {c: expected_points.get(c, 0) for c in remaining}

                        if replace_when_viable and remaining:
                            viable = count_viable_replacements(
                                remaining, prices_at_ep, ep_remaining, budget_freed, config=update_config
                            )
                            if viable["count"] > 0 and viable["viable"]:
                                best = viable["viable"][0]
                                new_player = best[0]
                                working_roster = [c for c in working_roster if c != voted_out]
                                working_roster.append(new_player)
                                total_replacement_penalty += add_player_penalty
                                replacement_count += 1

                        ph_idx += 1

                    # Captain required every episode
                    captain = pick_captain(working_roster, expected_points, ep)
                    captain_per_episode.append(captain)

                points = calculate_roster_points(
                    working_roster, episode_outcomes, scoring,
                    captain_per_episode=captain_per_episode,
                )
                total = points["total"] + total_replacement_penalty

                results.append({
                    "scenario": s,
                    "strategy": strategy,
                    "play_style": style_name,
                    "roster": working_roster,
                    "total": total,
                    "base_points": points["total"],
                    "captain_bonus": points.get("captain_bonus", 0),
                    "replacement_penalty": total_replacement_penalty,
                    "breakdown": points["breakdown"],
                    "event_breakdown": points.get("event_breakdown", {}),
                })

                for et, data in points.get("event_breakdown", {}).items():
                    event_breakdown_agg[et]["count"] += data.get("count", 0)
                    event_breakdown_agg[et]["points"] += data.get("points", 0)
                captain_bonus_agg += points.get("captain_bonus", 0)
                replacement_penalty_agg += total_replacement_penalty

    # Aggregate by (strategy, play_style)
    by_combo = defaultdict(list)
    for r in results:
        by_combo[(r["strategy"], r["play_style"])].append(r["total"])

    combo_stats = {}
    for (strat, style), scores in by_combo.items():
        combo_stats[f"{strat}_{style}"] = {
            "mean": sum(scores) / len(scores),
            "min": min(scores),
            "max": max(scores),
            "count": len(scores),
        }

    # Play style comparison (across all strategies)
    by_style = defaultdict(list)
    for r in results:
        by_style[r["play_style"]].append(r["total"])
    style_stats = {s: {"mean": sum(v)/len(v), "count": len(v)} for s, v in by_style.items()}

    analysis = {
        "num_scenarios": num_scenarios,
        "rosters_per_strategy": rosters_per_strategy,
        "total_runs": len(results),
        "combo_stats": combo_stats,
        "style_stats": style_stats,
        "event_breakdown_agg": dict(event_breakdown_agg),
        "captain_bonus_total": captain_bonus_agg,
        "replacement_count": replacement_count,
        "replacement_penalty_total": replacement_penalty_agg,
        "replacement_penalty": add_player_penalty,
        "captain_multiplier": CAPTAIN_MULTIPLIER,
        "prices": prices,
        "expected_points": expected_points,
    }

    report = generate_full_report(analysis, contestants)
    if output_dir:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        with open(output_dir / "FULL_SIMULATION_REPORT.md", "w") as f:
            f.write(report)
        with open(output_dir / "full_simulation_analysis.json", "w") as f:
            json.dump({
                "combo_stats": analysis["combo_stats"],
                "style_stats": analysis["style_stats"],
                "event_breakdown_agg": analysis["event_breakdown_agg"],
                "captain_bonus_total": analysis["captain_bonus_total"],
                "replacement_count": analysis["replacement_count"],
                "replacement_penalty_total": analysis["replacement_penalty_total"],
            }, f, indent=2)
        print(f"\nReport saved to {output_dir / 'FULL_SIMULATION_REPORT.md'}")

    return analysis


def generate_full_report(analysis: dict, contestants: list) -> str:
    lines = [
        "# Full-Stack Simulation Report",
        "",
        "## Overview",
        "",
        f"**Total runs:** {analysis['total_runs']:,} (scenarios × rosters × play styles)",
        f"**Scenarios:** {analysis['num_scenarios']}",
        f"**Replacement penalty:** {analysis['replacement_penalty']} points per add",
        f"**Captain multiplier:** {analysis['captain_multiplier']}x (required every episode)",
        "",
        "---",
        "",
        "## Executive Summary for Tuning",
        "",
    ]

    eb = analysis.get("event_breakdown_agg", {})
    total_pts = sum(d.get("points", 0) for d in eb.values())
    total_pts += analysis.get("captain_bonus_total", 0)
    total_pts += analysis.get("replacement_penalty_total", 0)
    survival_pts = sum(eb.get(et, {}).get("points", 0) for et in ["survival_pre_merge", "survival_swap", "survival_post_merge"])
    challenge_pts = sum(eb.get(et, {}).get("points", 0) for et in ["team_immunity_first", "team_immunity_second_three", "team_immunity_last", "team_reward_first", "team_reward_second_three", "individual_immunity"])
    voted_out_pts = eb.get("voted_out", {}).get("points", 0)
    vote_matched_pts = eb.get("vote_matched", {}).get("points", 0)
    cap_bonus = analysis.get("captain_bonus_total", 0)
    style_stats = analysis.get("style_stats", {})
    fixed_avg = style_stats.get("fixed", {}).get("mean", 0)
    replace_avg = style_stats.get("replace", {}).get("mean", 0)
    replace_lift = replace_avg - fixed_avg if fixed_avg else 0
    combo_stats = analysis.get("combo_stats", {})
    best_combo = max(combo_stats.items(), key=lambda x: x[1]["mean"]) if combo_stats else (None, {})
    worst_combo = min(combo_stats.items(), key=lambda x: x[1]["mean"]) if combo_stats else (None, {})

    lines.extend([
        "| Metric | Value | Tuning implication |",
        "|--------|-------|-------------------|",
        f"| Survival % of total | {100*survival_pts/total_pts:.1f}% | Core floor; adjust pre/post/swap if too flat |",
        f"| Challenges % of total | {100*challenge_pts/total_pts:.1f}% | Immunity/reward weights; individual immunity rare |",
        f"| Vote matched % | {100*vote_matched_pts/total_pts:.1f}% | High impact; consider if over-rewarding |",
        f"| Voted out penalty % | {100*voted_out_pts/total_pts:.1f}% | Major negative; pocket multiplier matters |",
        f"| Captain bonus % | {100*cap_bonus/total_pts:.1f}% | 2x adds ~{cap_bonus/analysis['total_runs']:.0f} pts/run avg |",
        f"| Replacement lift | +{replace_lift:.1f} pts vs fixed | Replace worth it despite {analysis['replacement_penalty']} add penalty |",
        f"| Best combo | {best_combo[0]} | Target for balance; others should close gap |",
        f"| Worst combo | {worst_combo[0]} | May need pricing/strategy tweaks |",
        "",
        "---",
        "",
        "## How the Simulation Works",
        "",
        "### Rules of Each Simulated Game",
        "",
        "1. **Initial roster:** 7 players, min 1 per tribe, under $1M budget. Built using strategy (value, max_expected, mid_tier, etc.).",
        "2. **No replacement (fixed):** When a roster member is voted off, they are not replaced. The roster shrinks; eliminated players stop earning points but can still incur voted-out penalty.",
        f"3. **Replacement (replace):** When a roster member is voted off, if viable replacements exist (affordable with freed budget, within value tolerance), the best-value option is added. A **{analysis['replacement_penalty']} point penalty** is applied per add (sell has no penalty).",
        "4. **Captain (required):** Every episode, captain = highest expected pts among active roster. Captain earns **2x points** for that episode only.",
        "5. **Price evolution:** Prices update after each tribal (demand-based: strong performers rise, weak fall). No universal inflation. All rosters in a scenario see the same price evolution.",
        "6. **Scoring:** Survival, challenges, tribal, advantages, placement. Same point values as production config.",
        "",
        "### Play Styles Tested",
        "",
        "| Style | Replacement | Captain |",
        "|-------|-------------|---------|",
        "| fixed | No | Yes (required) |",
        "| replace | Yes (when viable) | Yes (required) |",
        "",
        "---",
        "",
        "## Point Breakdown (Aggregate)",
        "",
    ])

    # Group by category
    categories = {
        "Survival": ["survival_pre_merge", "survival_swap", "survival_post_merge"],
        "Challenges": ["team_immunity_first", "team_immunity_second_three", "team_immunity_second_two",
                      "team_immunity_last", "team_reward_first", "team_reward_second_three",
                      "team_reward_second_two", "individual_immunity"],
        "Tribal": ["vote_matched", "voted_out"],
        "Advantages": ["clue_read", "advantage_play", "idol_play", "idol_failure", "strategic_player"],
        "Placement": ["final_tribal", "win_season"],
        "Other": ["quit"],
    }

    for cat_name, event_types in categories.items():
        cat_pts = sum(eb.get(et, {}).get("points", 0) for et in event_types)
        cat_pct = 100 * cat_pts / total_pts if total_pts else 0
        lines.append(f"### {cat_name}: {cat_pts:,.0f} points ({cat_pct:.1f}%)")
        lines.append("")
        for et in event_types:
            d = eb.get(et, {})
            pts = d.get("points", 0)
            cnt = d.get("count", 0)
            if cnt > 0 or pts != 0:
                pct = 100 * pts / total_pts if total_pts else 0
                lines.append(f"- **{et}:** {pts:,.0f} pts ({cnt:,} events, {pct:.1f}%)")
        lines.append("")

    cap_bonus = analysis.get("captain_bonus_total", 0)
    rep_pen = analysis.get("replacement_penalty_total", 0)
    lines.extend([
        f"### Captain Bonus: {cap_bonus:,.0f} points",
        f"### Replacement Penalty: {rep_pen:,.0f} points",
        "",
        "---",
        "",
        "## Play Style Comparison",
        "",
        "| Play Style | Avg Score | Runs |",
        "|------------|-----------|------|",
    ])
    for style, stats in sorted(analysis.get("style_stats", {}).items()):
        lines.append(f"| {style} | {stats['mean']:.1f} | {stats['count']:,} |")
    lines.extend([
        "",
        "---",
        "",
        "## Strategy × Play Style (Emerging Strategies)",
        "",
        "| Strategy | Play Style | Avg | Min | Max |",
        "|----------|------------|-----|-----|-----|",
    ])
    style_suffixes = ["replace", "fixed"]
    for key, stats in sorted(analysis.get("combo_stats", {}).items()):
        strat, style = key, "fixed"
        for suf in style_suffixes:
            if key.endswith("_" + suf):
                strat = key[: -len(suf) - 1]
                style = suf
                break
        lines.append(f"| {strat} | {style} | {stats['mean']:.1f} | {stats['min']} | {stats['max']} |")
    lines.extend([
        "",
        "---",
        "",
        "## Captaincy Impact",
        "",
        f"Total captain bonus across all runs: **{cap_bonus:,.0f}** points (~{cap_bonus/analysis['total_runs']:.0f} per run).",
        "Captain is required every episode; chosen as highest expected pts among active roster.",
        "**Tuning:** If captain bonus dominates, lower multiplier (e.g. 1.5x). If too weak, raise it.",
        "",
        "---",
        "",
        "## Tuning Recommendations",
        "",
        "### Point System",
        "- **Survival vs challenges:** If survival dominates (>45%), consider raising challenge pts (immunity, reward).",
        "- **Vote matched:** Often highest positive event. If you want less predictability, lower it.",
        "- **Voted out:** Pocket multiplier (2^items) can create huge swings. Consider capping or flattening.",
        "- **Strategic player:** High variance event. Adjust if too swingy.",
        "",
        "### Pricing",
        "- **price_min/max:** Wider range = more roster diversity but harder to balance.",
        "- **target_valid_pct:** Lower = fewer viable combos = more budget pressure.",
        f"- **Add player penalty:** {analysis['replacement_penalty']} per add (sell has no penalty). If replace always dominates, raise penalty.",
        "",
        "### Strategy Balance",
        f"- Best: **{best_combo[0] or 'N/A'}** (avg {best_combo[1].get('mean', 0):.1f}). Worst: **{worst_combo[0] or 'N/A'}** (avg {worst_combo[1].get('mean', 0):.1f}).",
        f"- Gap: {best_combo[1].get('mean', 0) - worst_combo[1].get('mean', 0):.1f} pts. Narrow by: flattening prices, adjusting point weights, or roster constraints.",
        "",
        "---",
        "",
        "## Roster Change Viability",
        "",
        f"**Replacements made:** {analysis.get('replacement_count', 0):,}",
        f"**Total replacement penalty:** {rep_pen:,.0f} points",
        f"**Penalty per replacement:** {analysis['replacement_penalty']}",
        "",
        "Replacements occur when a roster member is voted off and viable options exist",
        "(affordable with freed budget, within value tolerance). Constant roster changes",
        f"are viable when replacements are affordable; the {analysis['replacement_penalty']} point add penalty creates",
        "tradeoff between keeping a weaker roster vs. paying to upgrade.",
        "",
        "---",
        "",
        "## Price Changes: How Big of a Deal?",
        "",
        "Prices update after each tribal via demand-based movement:",
        "- **Performance delta:** Strong performers (immunity, vote matched) rise; weak performers fall",
        "- **No universal inflation:** Prices differentiate by performance only; no lockstep rise",
        "",
        "**Impact on replacements:** When a roster member is voted off, budget freed = their price.",
        "Higher-priced vote-offs (e.g. $200k) free more budget for replacements than cheap vote-offs ($100k).",
        "Early cheap vote-offs often yield 0 affordable replacements; late expensive vote-offs",
        "free budget but fewer players remain. Price dynamics create strategic tension:",
        "owning expensive players risks early vote-off with limited replacement options.",
        "",
        f"**Impact on strategy:** Replace outperforms fixed by **+{replace_lift:.1f} pts** on average,",
        f"despite the {analysis['replacement_penalty']} penalty per add. If this gap is too large, consider:",
        "raising replacement penalty, tightening value tolerance, or reducing merge budget.",
        "",
        "---",
        "",
        "## Highest Potential Captaincies",
        "",
        "Contestants with highest expected points offer the most captain upside:",
        "",
    ])
    sorted_by_ep = sorted(
        analysis.get("expected_points", {}).items(),
        key=lambda x: x[1],
        reverse=True,
    )[:10]
    for cid, ep in sorted_by_ep:
        lines.append(f"- **{cid}:** {ep:.1f} expected pts (2x when captained)")
    lines.append("")

    return "\n".join(lines)


def main():
    base = Path(__file__).parent.parent.parent
    output_dir = base / "output" / "simulation"

    print("Running Full-Stack Simulation...")
    analysis = run_full_simulation(
        num_scenarios=50,
        rosters_per_strategy=5,
        seed=42,
        output_dir=output_dir,
    )

    print("\n" + "=" * 50)
    print("FULL SIMULATION SUMMARY")
    print("=" * 50)
    print(f"Total runs: {analysis['total_runs']}")
    print(f"Captain bonus total: {analysis['captain_bonus_total']:,.0f}")
    print(f"Replacements made: {analysis['replacement_count']}")
    for style, s in analysis.get("style_stats", {}).items():
        print(f"  {style}: avg {s['mean']:.1f}")


if __name__ == "__main__":
    main()
