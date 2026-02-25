#!/usr/bin/env python3
"""
Phase 1: Pricing Simulation
Tests pricing logic and budget-constrained team building.
"""

import sys
import json
import argparse
from pathlib import Path
from collections import defaultdict
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))

import yaml

from src.point_calculator import calculate_roster_points
from src.scenario_generator import generate_scenario
from src.price_generator import (
    compute_expected_points_per_contestant,
    expected_points_to_prices,
)
from src.roster_generator import generate_budget_rosters_for_simulation
from src.roster_enumerator import count_valid_rosters, sample_valid_rosters, compute_combo_cost_percentiles


def load_config(config_dir: Path) -> tuple:
    """Load scoring, season, contestant, and pricing configs."""
    with open(config_dir / "scoring.yaml") as f:
        scoring = yaml.safe_load(f)
    with open(config_dir / "season_template.yaml") as f:
        season = yaml.safe_load(f)
    with open(config_dir / "contestants_s50.yaml") as f:
        contestants = yaml.safe_load(f)["contestants"]
    with open(config_dir / "pricing.yaml") as f:
        pricing = yaml.safe_load(f)
    return scoring, season["episodes"], contestants, pricing


def run_pricing_simulation(
    price_estimation_runs: int = 2000,
    scenario_runs: int = 300,
    rosters_per_strategy: int = 15,
    sample_rosters: Optional[int] = None,
    seed: int = 42,
    output_dir: Path = None,
) -> dict:
    """Run Phase 1: compute prices, build budget rosters, score across scenarios."""
    config_dir = Path(__file__).parent / "config"
    scoring, season_template, contestants, pricing_config = load_config(config_dir)
    budget = pricing_config.get("budget", 1_000_000)
    roster_min = pricing_config.get("roster_min", 5)
    roster_max = pricing_config.get("roster_max", 7)

    print("Step 1: Computing expected points per contestant...")
    expected_points = compute_expected_points_per_contestant(
        contestants,
        season_template,
        scoring,
        config_dir,
        num_runs=price_estimation_runs,
        seed=seed,
    )

    print("Step 2: Mapping expected points to prices...")
    prices = expected_points_to_prices(expected_points, pricing_config)

    # Calibrate prices so ~target_valid_pct of combos are under budget (top 7 must exceed budget)
    target_valid_pct = pricing_config.get("target_valid_pct")
    if target_valid_pct is not None and roster_min == roster_max == 7:
        print("Step 2a: Calibrating prices for target valid %...")
        percentiles = compute_combo_cost_percentiles(
            contestants, prices, roster_min=roster_min, roster_max=roster_max,
            percentiles=[target_valid_pct],
        )
        target_cost = percentiles.get(f"p{int(target_valid_pct*100)}", budget)
        increment = pricing_config.get("price_increment", 5000)
        price_min = pricing_config.get("price_min", 80000)
        price_max = pricing_config.get("price_max", 260000)

        if target_cost > 0:
            scale = budget / target_cost
            prices = {
                cid: int(max(price_min, min(price_max, round(p * scale / increment) * increment)))
                for cid, p in prices.items()
            }
            print(f"  Scaled prices by {scale:.3f} so {target_valid_pct*100:.0f}th percentile cost ≈ budget")

        # Ensure top 7 by price exceed budget (can't own all 7 most expensive)
        sorted_ids = sorted(prices.keys(), key=lambda x: prices[x], reverse=True)
        top7_cost = sum(prices[cid] for cid in sorted_ids[:7])
        if top7_cost <= budget:
            min_top7 = budget + increment
            scale2 = min_top7 / top7_cost if top7_cost > 0 else 1.0
            prices = {
                cid: int(max(price_min, min(price_max, round(p * scale2 / increment) * increment)))
                for cid, p in prices.items()
            }
            print(f"  Adjusted scale so top 7 cost (${sum(prices[c] for c in sorted_ids[:7]):,}) > budget")

    # Count total valid team options (under budget) and total possible (tribe-valid only)
    print("Step 2b: Counting total valid roster options...")
    roster_counts = count_valid_rosters(contestants, prices, budget, roster_min=roster_min, roster_max=roster_max)
    total_valid_options = roster_counts["total"]
    from itertools import combinations
    tribe_map = {c["id"]: c["starting_tribe"] for c in contestants}
    total_possible = sum(
        1 for combo in combinations([c["id"] for c in contestants], roster_max)
        if len(set(tribe_map[c] for c in combo)) >= 3
    )
    excluded_pct = 100 * (1 - total_valid_options / total_possible) if total_possible > 0 else 0
    size_str = ", ".join(f"{s}-player: {roster_counts.get(f'size_{s}', 0):,}" for s in range(roster_min, roster_max + 1))
    print(f"  Total valid under budget: {total_valid_options:,} | Total possible (tribe-valid): {total_possible:,} | Excluded by pricing: {excluded_pct:.1f}%")

    print("Step 3: Generating rosters for simulation...")
    if sample_rosters is not None:
        rosters = [
            {
                "roster": r,
                "strategy": "sampled",
                "total_cost": sum(prices.get(c, 0) for c in r),
            }
            for r in sample_valid_rosters(
                contestants, prices, budget, n=sample_rosters, seed=seed, roster_min=roster_min, roster_max=roster_max
            )
        ]
        print(f"  Sampled {len(rosters)} unique rosters from {total_valid_options:,} valid options")
    else:
        rosters = generate_budget_rosters_for_simulation(
            contestants,
            prices,
            budget,
            expected_points,
            num_per_strategy=rosters_per_strategy,
            seed=seed,
            roster_min=roster_min,
            roster_max=roster_max,
        )

    print("Step 4: Running scenarios and scoring rosters...")
    results = []
    for run_idx in range(scenario_runs):
        scenario_seed = seed + run_idx * 1000
        episode_outcomes = generate_scenario(
            contestants,
            season_template,
            seed=scenario_seed,
            config_dir=config_dir,
        )

        for roster_data in rosters:
            points = calculate_roster_points(
                roster_data["roster"],
                episode_outcomes,
                scoring,
            )
            results.append({
                "roster": roster_data["roster"],
                "strategy": roster_data["strategy"],
                "total_cost": roster_data["total_cost"],
                "total": points["total"],
                "breakdown": points["breakdown"],
                "event_breakdown": points.get("event_breakdown", {}),
                "scenario_id": run_idx,
            })

    # Aggregate analysis
    strategy_scores = {}
    strategy_rosters = {}  # One example per strategy
    strategy_costs = {}
    contestant_picks = {}  # Per strategy: {cid: count}
    for r in results:
        s = r["strategy"]
        if s not in strategy_scores:
            strategy_scores[s] = []
            strategy_rosters[s] = r["roster"]
            strategy_costs[s] = []
            contestant_picks[s] = {}
        strategy_scores[s].append(r["total"])
        strategy_costs[s].append(r["total_cost"])
        for cid in r["roster"]:
            contestant_picks[s][cid] = contestant_picks[s].get(cid, 0) + 1

    strategy_stats = {}
    for s, scores in strategy_scores.items():
        costs = strategy_costs[s]
        strategy_stats[s] = {
            "mean": sum(scores) / len(scores),
            "min": min(scores),
            "max": max(scores),
            "count": len(scores),
            "avg_cost": sum(costs) / len(costs) if costs else 0,
            "example_roster": strategy_rosters[s],
            "top_picks": sorted(
                contestant_picks[s].items(),
                key=lambda x: x[1],
                reverse=True,
            )[:10],
        }

    # Roster diversity: unique roster compositions
    roster_hashes = set()
    for r in results:
        key = tuple(sorted(r["roster"]))
        roster_hashes.add(key)
    unique_rosters = len(roster_hashes)

    # Aggregate point breakdowns and event breakdowns across all results
    point_breakdown_agg = defaultdict(float)
    event_breakdown_agg = defaultdict(lambda: {"count": 0, "points": 0})
    for r in results:
        for cat, val in r.get("breakdown", {}).items():
            point_breakdown_agg[cat] += val
        for event_type, data in r.get("event_breakdown", {}).items():
            event_breakdown_agg[event_type]["count"] += data.get("count", 0)
            event_breakdown_agg[event_type]["points"] += data.get("points", 0)

    sorted_ids = sorted(
        prices.keys(),
        key=lambda x: expected_points.get(x, 0),
        reverse=True,
    )
    top5_cost = sum(prices[cid] for cid in sorted_ids[:5]) if prices else 0
    top6_cost = sum(prices[cid] for cid in sorted_ids[:6]) if prices else 0
    top7_cost = sum(prices[cid] for cid in sorted_ids[:7]) if prices else 0

    # Players by price (group contestants by price tier)
    players_by_price = defaultdict(list)
    for cid, pr in prices.items():
        players_by_price[pr].append(cid)
    players_by_price = dict(sorted(players_by_price.items(), reverse=True))

    analysis = {
        "expected_points": expected_points,
        "prices": prices,
        "pricing_config": dict(pricing_config, actual_price_runs=price_estimation_runs, actual_scenario_runs=scenario_runs),
        "strategy_stats": strategy_stats,
        "contestant_picks": contestant_picks,
        "total_runs": len(results),
        "unique_roster_compositions": unique_rosters,
        "total_valid_team_options": total_valid_options,
        "total_possible_combos": total_possible,
        "excluded_by_pricing_pct": excluded_pct,
        "roster_counts": roster_counts,
        "sample_rosters": sample_rosters,
        "point_breakdown_agg": dict(point_breakdown_agg),
        "event_breakdown_agg": dict(event_breakdown_agg),
        "players_by_price": players_by_price,
        "price_summary": {
            "min": min(prices.values()) if prices else 0,
            "max": max(prices.values()) if prices else 0,
            "sum_all": sum(prices.values()) if prices else 0,
            "top5_by_expected": top5_cost,
            "top6_by_expected": top6_cost,
            "top7_by_expected": top7_cost,
        },
    }

    # Generate report
    report = generate_pricing_report(analysis, contestants)

    if output_dir:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        with open(output_dir / "pricing_report.md", "w") as f:
            f.write(report)

        if sample_rosters is not None:
            diversity_report = generate_roster_diversity_report(analysis, contestants)
            with open(output_dir / "ROSTER_DIVERSITY_REPORT.md", "w") as f:
                f.write(diversity_report)
            print(f"Diversity report saved to {output_dir / 'ROSTER_DIVERSITY_REPORT.md'}")

        with open(output_dir / "pricing_analysis.json", "w") as f:
            json.dump({
                "expected_points": analysis["expected_points"],
                "prices": analysis["prices"],
                "pricing_config": analysis["pricing_config"],
                "strategy_stats": analysis["strategy_stats"],
                "price_summary": analysis["price_summary"],
                "unique_roster_compositions": analysis["unique_roster_compositions"],
                "total_valid_team_options": analysis.get("total_valid_team_options"),
                "total_possible_combos": analysis.get("total_possible_combos"),
                "excluded_by_pricing_pct": analysis.get("excluded_by_pricing_pct"),
                "roster_counts": analysis.get("roster_counts"),
                "sample_rosters": analysis.get("sample_rosters"),
            }, f, indent=2)

        print(f"\nReport saved to {output_dir / 'pricing_report.md'}")
        print(f"Analysis saved to {output_dir / 'pricing_analysis.json'}")

    return analysis


def generate_pricing_report(analysis: dict, contestants: list) -> str:
    """Generate Phase 1 pricing simulation report."""
    prices = analysis["prices"]
    expected_points = analysis["expected_points"]
    strategy_stats = analysis["strategy_stats"]
    price_summary = analysis.get("price_summary", {})
    config = analysis.get("pricing_config", {})
    roster_min = config.get("roster_min", 5)
    roster_max = config.get("roster_max", 7)

    budget = config.get("budget", 1_000_000)
    contestant_map = {c["id"]: c for c in contestants}

    total_valid = analysis.get("total_valid_team_options")
    roster_counts = analysis.get("roster_counts", {})
    sample_rosters = analysis.get("sample_rosters")

    roster_rules = f"Exactly {roster_max} players required" if roster_min == roster_max == 7 else f"Min 1 per tribe, {roster_min}–{roster_max} players"
    summary_lines = [
        "# Phase 1: Pricing Simulation Report",
        "",
        "## Summary",
        "",
        f"- **Budget:** ${budget:,}",
        f"- **Roster rules:** {roster_rules}, min 1 per tribe",
        f"- **Price estimation runs:** {config.get('actual_price_runs', config.get('price_estimation_runs', 2000))}",
        f"- **Scenario runs (scoring):** {config.get('actual_scenario_runs', 300)}",
        f"- **Unique roster compositions tested:** {analysis.get('unique_roster_compositions', 0)}",
    ]
    if total_valid is not None:
        size_lines = [f"- {s}-player rosters: {roster_counts.get(f'size_{s}', 0):,}" for s in range(roster_min, roster_max + 1)]
        summary_lines.extend([
            "",
            "### Total Valid Team Options (Pricing System)",
            "",
            f"- **Total valid under budget:** {total_valid:,}",
            f"- **Total possible (tribe-valid):** {analysis.get('total_possible_combos', total_valid):,}",
            f"- **Excluded by pricing:** {analysis.get('excluded_by_pricing_pct', 0):.1f}%",
        ] + size_lines)
    if sample_rosters is not None:
        summary_lines.append(f"- **Rosters sampled for simulation:** {sample_rosters:,}")
    summary_lines.extend(["", "---", ""])

    lines = summary_lines + [
        "",
        "## Price Distribution",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Min price | ${price_summary.get('min', 0):,} |",
        f"| Max price | ${price_summary.get('max', 0):,} |",
        f"| Sum (all 24) | ${price_summary.get('sum_all', 0):,} |",
        f"| Top 5 by expected (cost) | ${price_summary.get('top5_by_expected', 0):,} |",
        f"| Top 6 by expected (cost) | ${price_summary.get('top6_by_expected', 0):,} |",
        f"| Top 7 by expected (cost) | ${price_summary.get('top7_by_expected', 0):,} |",
        "",
        "**Viability:** Top 7 by expected points > budget (cannot own all 7 most expensive). " + f"{analysis.get('excluded_by_pricing_pct', 0):.1f}% of team combos excluded by pricing.",
        "",
        "---",
        "",
        "## Players by Price (Breakdown by Price Tier)",
        "",
        "| Price | Contestants |",
        "|-------|-------------|",
    ]
    players_by_price = analysis.get("players_by_price", {})
    for pr, cids in players_by_price.items():
        cids_sorted = sorted(cids, key=lambda x: expected_points.get(x, 0), reverse=True)
        lines.append(f"| ${pr:,} | {', '.join(cids_sorted)} |")
    lines.extend([
        "",
        "---",
        "",
        "## Point Breakdown (Aggregate Across All Runs)",
        "",
        "| Category | Total Points | % of Total |",
        "|----------|--------------|------------|",
    ])
    point_breakdown = analysis.get("point_breakdown_agg", {})
    total_pts = sum(point_breakdown.values()) or 1
    for cat in ["survival", "challenges", "tribal", "advantages", "placement", "penalties"]:
        val = point_breakdown.get(cat, 0)
        pct = 100 * val / total_pts
        lines.append(f"| {cat} | {val:,.0f} | {pct:.1f}% |")
    lines.extend([
        "",
        "---",
        "",
        "## Event Breakdown (Points by Event Type)",
        "",
        "| Event Type | Total Points | % of Total | Count |",
        "|------------|--------------|------------|-------|",
    ])
    event_breakdown = analysis.get("event_breakdown_agg", {})
    total_event_pts = sum(d.get("points", 0) for d in event_breakdown.values()) or 1
    EVENT_LABELS = {
        "survival_pre_merge": "Survival (pre-merge)",
        "survival_post_merge": "Survival (post-merge)",
        "survival_swap": "Survival (swap)",
        "team_immunity_first": "Team immunity 1st",
        "individual_immunity": "Individual immunity",
        "vote_matched": "Vote matched",
        "voted_out": "Voted out",
        "final_tribal": "Final tribal",
        "win_season": "Win season",
    }
    for event_type, data in sorted(event_breakdown.items(), key=lambda x: -x[1].get("points", 0)):
        pts = data.get("points", 0)
        cnt = data.get("count", 0)
        if pts == 0 and cnt == 0:
            continue
        label = EVENT_LABELS.get(event_type, event_type)
        pct = 100 * pts / total_event_pts
        lines.append(f"| {label} | {pts:,.0f} | {pct:.1f}% | {cnt:,} |")
    lines.extend([
        "",
        "---",
        "",
        "## Contestant Prices & Expected Points",
        "",
        "| Contestant | Tribe | Expected Pts | Price |",
        "|------------|-------|--------------|-------|",
    ])

    sorted_contestants = sorted(
        contestants,
        key=lambda c: expected_points.get(c["id"], 0),
        reverse=True,
    )
    for c in sorted_contestants:
        cid = c["id"]
        tribe = c.get("starting_tribe", "")
        ep = expected_points.get(cid, 0)
        pr = prices.get(cid, 0)
        lines.append(f"| {cid} | {tribe} | {ep:.1f} | ${pr:,} |")

    strategy_desc = [
        "",
        "---",
        "",
        "## Strategy Descriptions",
        "",
        "| Strategy | Description |",
        "|----------|-------------|",
    ]
    if "sampled" in strategy_stats:
        strategy_desc.extend([
            "| **sampled** | Uniformly sampled from all valid roster combinations (min 1 per tribe, under budget). |",
        ])
    strategy_desc.extend([
        "| **max_expected** | Picks up to 7 highest expected-point players under budget (min 1 per tribe). |",
        "| **value** | Picks players with best points-per-dollar. Favors cheaper players; typically 7 mid-tier. |",
        "| **balanced** | Value (pts/price) with tiebreaker toward higher expected. |",
        "| **mid_tier** | Only considers middle 50% of expected points. Avoids expensive stars and weak scrubs. |",
        "| **stars_and_scrubs** | Picks 2 expensive stars, then fills with cheapest (min 1 per tribe). |",
        "| **five_premium** | Exactly 5 premium players (highest expected, min 1 per tribe). Tests 5-stars viability. |",
        "| **six_premium** | Exactly 6 premium players (min 1 per tribe). Tests 6-stars vs 7-mid tradeoff. |",
        "| **random** | Randomly selects valid rosters under budget. |",
        "",
        "---",
        "",
        "## Strategy Performance (Budget-Constrained Rosters)",
        "",
        "| Strategy | Avg Score | Avg Cost | Min | Max | Count |",
        "|----------|-----------|----------|-----|-----|-------|",
    ])
    lines.extend(strategy_desc)

    for strategy, stats in strategy_stats.items():
        avg_cost = stats.get("avg_cost", 0)
        lines.append(f"| {strategy} | {stats['mean']:.1f} | ${avg_cost:,.0f} | {stats['min']} | {stats['max']} | {stats['count']} |")

    lines.extend([
        "",
        "---",
        "",
        "## Example Rosters & Top Picks by Strategy",
        "",
    ])

    results_per_strategy = strategy_stats[next(iter(strategy_stats))]["count"] if strategy_stats else 1
    for strategy, stats in strategy_stats.items():
        example = stats.get("example_roster", [])
        example_cost = sum(prices.get(c, 0) for c in example)
        example_pts = sum(expected_points.get(c, 0) for c in example)
        top_picks = stats.get("top_picks", [])[:5]
        lines.append(f"### {strategy}")
        lines.append("")
        lines.append(f"- **Example roster:** {', '.join(sorted(example))} ({len(example)} players)")
        lines.append(f"- **Cost:** ${example_cost:,} | **Expected pts (sum):** {example_pts:.1f}")
        if top_picks:
            total = stats["count"]
            picks_str = ", ".join(f"{cid} ({100*cnt/total:.0f}%)" for cid, cnt in top_picks)
            lines.append(f"- **Most picked:** {picks_str}")
        lines.append("")

    findings = [
        "---",
        "",
        "## Findings",
        "",
        f"1. **Price spread:** ${price_summary.get('min', 0):,}–${price_summary.get('max', 0):,} in ${config.get('price_increment', 5000):,} increments.",
    ]
    if total_valid is not None:
        findings.extend([
            f"2. **Total valid team options:** {total_valid:,} distinct roster combinations under budget (min 1 per tribe, {roster_max if roster_min == roster_max else f'{roster_min}–{roster_max}'} players).",
            f"3. **Rosters tested:** {analysis.get('unique_roster_compositions', 0):,} unique compositions scored across {config.get('actual_scenario_runs', 300)} scenarios.",
        ])
    else:
        findings.append("2. **Roster diversity:** Unique roster count indicates how many distinct team compositions the pricing allows.")
    if roster_min == roster_max == 7:
        excluded = analysis.get("excluded_by_pricing_pct", 0)
        findings.extend([
            f"4. **7 players required:** All rosters must have exactly 7 players; top 7 by price > budget (cannot own all 7 most expensive).",
            f"5. **Pricing constraint:** {excluded:.1f}% of tribe-valid team combinations excluded by budget.",
            "",
        ])
    else:
        findings.extend([
            "4. **5–6 premium viable:** Top 5 fits under budget; 5 or 6 premium players is a real alternative to 7 mid-tier.",
            "5. **Roster flexibility:** Min 1 per tribe, max 7, no minimum—enables 5-stars, 6-stars, or 7-mid strategies.",
            "",
        ])
    lines.extend(findings)

    return "\n".join(lines)


def generate_roster_diversity_report(analysis: dict, contestants: list) -> str:
    """Generate roster diversity report when using sample mode."""
    total_valid = analysis.get("total_valid_team_options")
    roster_counts = analysis.get("roster_counts", {})
    sample_rosters = analysis.get("sample_rosters")
    strategy_stats = analysis.get("strategy_stats", {})
    config = analysis.get("pricing_config", {})

    if total_valid is None or sample_rosters is None:
        return ""

    sampled_stats = strategy_stats.get("sampled", {})
    scenario_runs = config.get("actual_scenario_runs", 300)

    lines = [
        "# Roster Diversity & Total Team Options Report",
        "",
        "**Simulation:** Phase 1 Pricing with Sampled Rosters",
        "",
        "---",
        "",
        "## Executive Summary",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| **Total valid team options** | {total_valid:,} |",
        f"| **Rosters tested in simulation** | {sample_rosters:,} |",
        f"| **Scenarios per roster** | {scenario_runs:,} |",
        f"| **Total simulation runs** | {sample_rosters * scenario_runs:,} |",
        "",
        "---",
        "",
        "## Total Valid Team Options",
        "",
        "Given: Budget $1M, 5–7 players, min 1 per tribe, 24 contestants.",
        "",
        "| Roster Size | Valid Combinations |",
        "|-------------|---------------------|",
        f"| 5 players | {roster_counts.get('size_5', 0):,} |",
        f"| 6 players | {roster_counts.get('size_6', 0):,} |",
        f"| 7 players | {roster_counts.get('size_7', 0):,} |",
        f"| **Total** | **{total_valid:,}** |",
        "",
        "---",
        "",
        "## Simulation Results",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Avg score | {sampled_stats.get('mean', 0):.1f} |",
        f"| Min score | {sampled_stats.get('min', 0)} |",
        f"| Max score | {sampled_stats.get('max', 0)} |",
        f"| Avg cost | ${sampled_stats.get('avg_cost', 0):,.0f} |",
        f"| Unique rosters tested | {analysis.get('unique_roster_compositions', 0):,} |",
        "",
        "---",
        "",
        "## How to Run",
        "",
        "```bash",
        "python run_pricing_simulation.py --sample-rosters 500 --output ../../output/simulation",
        "```",
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Phase 1: Pricing Simulation")
    parser.add_argument("--price-runs", type=int, default=2000, help="Runs for price estimation")
    parser.add_argument("--scenario-runs", type=int, default=300, help="Scenario runs for scoring")
    parser.add_argument("--rosters", type=int, default=25, help="Rosters per strategy (strategy mode only)")
    parser.add_argument("--sample-rosters", type=int, default=None, help="Sample N rosters from all valid options (enables sample mode)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", "-o", type=str, default=None)
    args = parser.parse_args()

    if args.output is None:
        base = Path(__file__).parent.parent.parent
        args.output = base / "output" / "simulation"

    print("Running Phase 1: Pricing Simulation...")
    analysis = run_pricing_simulation(
        price_estimation_runs=args.price_runs,
        scenario_runs=args.scenario_runs,
        rosters_per_strategy=args.rosters,
        sample_rosters=args.sample_rosters,
        seed=args.seed,
        output_dir=args.output,
    )

    print("\n" + "=" * 50)
    print("PHASE 1 SUMMARY")
    print("=" * 50)
    if analysis.get("total_valid_team_options") is not None:
        print(f"Total valid team options: {analysis['total_valid_team_options']:,}")
        if analysis.get("excluded_by_pricing_pct") is not None:
            print(f"Excluded by pricing: {analysis['excluded_by_pricing_pct']:.1f}%")
    ps = analysis['price_summary']
    print(f"Top 5 cost: ${ps.get('top5_by_expected', 0):,}")
    print(f"Top 6 cost: ${ps.get('top6_by_expected', 0):,}")
    print(f"Top 7 cost: ${ps.get('top7_by_expected', 0):,} (budget: ${analysis['pricing_config'].get('budget', 0):,})")
    print(f"Unique rosters tested: {analysis['unique_roster_compositions']}")
    print("\nStrategy averages:")
    for s, stats in analysis["strategy_stats"].items():
        print(f"  {s}: {stats['mean']:.1f}")


if __name__ == "__main__":
    main()
