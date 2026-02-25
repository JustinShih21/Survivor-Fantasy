#!/usr/bin/env python3
"""
Dynamic Pricing Simulation: Episode-reactive price updates.
Tests how prices change after each episode and whether replacement scenarios
have multiple viable options (no single obvious pick).
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
from src.roster_enumerator import sample_valid_rosters, count_valid_rosters, count_tribe_valid_combos
from src.dynamic_pricing import update_prices_from_episode, count_viable_replacements


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


def run_dynamic_pricing_simulation(
    num_scenarios: int = 50,
    rosters_per_scenario: int = 100,
    seed: int = 42,
    output_dir: Path = None,
) -> dict:
    config_dir = Path(__file__).parent / "config"
    scoring, season_template, contestants, pricing_config, dynamic_config = load_config(config_dir)
    budget = pricing_config.get("budget", 1_000_000)
    tribe_map = {c["id"]: c["starting_tribe"] for c in contestants}

    print("Step 1: Computing initial expected points and prices...")
    expected_points = compute_expected_points_per_contestant(
        contestants, season_template, scoring, config_dir, num_runs=500, seed=seed
    )
    prices = expected_points_to_prices(expected_points, pricing_config)

    # Merge dynamic config into pricing for update_prices_from_episode
    update_config = dict(pricing_config, **dynamic_config)

    print("Step 2: Running dynamic pricing scenarios...")
    scenario_results = []
    replacement_stats = []

    for s in range(num_scenarios):
        scenario_seed = seed + s * 7777
        episode_outcomes = generate_scenario(
            contestants, season_template, seed=scenario_seed, config_dir=config_dir
        )

        # Track prices through episodes
        current_prices = dict(prices)
        price_history = [dict(current_prices)]

        for ep_idx, ep in enumerate(episode_outcomes):
            if ep.get("final_tribal"):
                break

            voted_out = ep.get("voted_out")
            if not voted_out:
                continue

            # Budget freed = what the team had tied up in that player (pre-update price)
            budget_freed = current_prices.get(voted_out, 100000)

            # Update prices based on this episode (tribal_episode_count = ep_idx + 1)
            current_prices = update_prices_from_episode(
                current_prices, ep, scoring, update_config,
                episode_index=ep_idx,
                tribal_episode_count=ep_idx + 1,
            )
            price_history.append(dict(current_prices))

            # Replacement scenario: teams with voted_out need to replace
            # Replacement pool = everyone still in the game (active_contestants)
            remaining = list(ep.get("active_contestants", []))
            if not remaining:
                continue

            # Expected points for remaining (use initial - in practice would update)
            ep_remaining = {c: expected_points.get(c, 0) for c in remaining}

            viable = count_viable_replacements(
                remaining,
                current_prices,
                ep_remaining,
                budget_freed,
                config=update_config,
            )

            replacement_stats.append({
                "scenario": s,
                "episode": ep_idx + 1,
                "voted_out": voted_out,
                "viable_count": viable["count"],
                "best_value": viable["best_value"],
                "affordable_count": viable.get("affordable_count", viable.get("all_options", 0)),
                "viable_ids": [x[0] for x in viable["viable"]],
            })

            # Merge validation: when 10-12 players left, compute valid combo %
            if len(remaining) in (10, 11, 12):
                remaining_contestants = [c for c in contestants if c["id"] in remaining]
                if len(remaining_contestants) >= 7:
                    merge_budget = dynamic_config.get("merge_budget", budget)
                    valid_counts = count_valid_rosters(
                        remaining_contestants, current_prices, merge_budget,
                        roster_min=7, roster_max=7,
                    )
                    total_tribe_valid = count_tribe_valid_combos(
                        remaining_contestants, roster_min=7, roster_max=7,
                    )
                    merge_valid = valid_counts["total"]
                    merge_pct = 100 * merge_valid / total_tribe_valid if total_tribe_valid > 0 else 0
                    replacement_stats[-1]["merge_valid_pct"] = merge_pct
                    replacement_stats[-1]["merge_valid_count"] = merge_valid
                    replacement_stats[-1]["merge_total_tribe_valid"] = total_tribe_valid

        scenario_results.append({
            "scenario_id": s,
            "episode_outcomes": episode_outcomes,
            "price_history": price_history,
        })

    # Aggregate stats
    viable_counts = [r["viable_count"] for r in replacement_stats]
    avg_viable = sum(viable_counts) / len(viable_counts) if viable_counts else 0
    min_viable = min(viable_counts) if viable_counts else 0
    pct_with_3plus = 100 * sum(1 for v in viable_counts if v >= 3) / len(viable_counts) if viable_counts else 0

    # Merge validation stats (10-12 players left)
    merge_events = [r for r in replacement_stats if "merge_valid_pct" in r]
    avg_merge_valid_pct = sum(r["merge_valid_pct"] for r in merge_events) / len(merge_events) if merge_events else 0

    # Price evolution sample: first scenario, first 5 vote-offs
    price_evolution = []
    if scenario_results:
        s0 = scenario_results[0]
        for ep_idx, ph in enumerate(s0["price_history"][:6]):  # Ep 0-5
            sample_ids = list(ph.keys())[:5]
            price_evolution.append({
                "episode": ep_idx,
                "sample_prices": {cid: ph[cid] for cid in sample_ids},
            })

    target_merge_valid = dynamic_config.get("target_merge_valid_pct", 0.70) * 100

    analysis = {
        "num_scenarios": num_scenarios,
        "replacement_events": len(replacement_stats),
        "avg_viable_replacements": avg_viable,
        "min_viable_replacements": min_viable,
        "pct_with_3plus_viable": pct_with_3plus,
        "merge_events": len(merge_events),
        "avg_merge_valid_pct": avg_merge_valid_pct,
        "merge_valid_pct_target": target_merge_valid,
        "replacement_stats": replacement_stats[:50],
        "price_evolution": price_evolution,
        "dynamic_config": dynamic_config,
        "initial_prices": prices,
        "expected_points": expected_points,
    }

    # Generate report
    report = generate_dynamic_pricing_report(analysis, contestants)

    if output_dir:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        with open(output_dir / "DYNAMIC_PRICING_REPORT.md", "w") as f:
            f.write(report)
        with open(output_dir / "dynamic_pricing_analysis.json", "w") as f:
            json.dump({
                "num_scenarios": analysis["num_scenarios"],
                "replacement_events": analysis["replacement_events"],
                "avg_viable_replacements": analysis["avg_viable_replacements"],
                "min_viable_replacements": analysis["min_viable_replacements"],
                "pct_with_3plus_viable": analysis["pct_with_3plus_viable"],
                "merge_events": analysis["merge_events"],
                "avg_merge_valid_pct": analysis["avg_merge_valid_pct"],
                "merge_valid_pct_target": analysis["merge_valid_pct_target"],
                "dynamic_config": analysis["dynamic_config"],
                "replacement_stats_sample": analysis["replacement_stats"],
            }, f, indent=2)
        print(f"\nReport saved to {output_dir / 'DYNAMIC_PRICING_REPORT.md'}")

    return analysis


def generate_dynamic_pricing_report(analysis: dict, contestants: list) -> str:
    lines = [
        "# Dynamic Pricing Simulation Report",
        "",
        "## Overview",
        "",
        "This report documents how **episode-reactive price changes** work and whether they create "
        "**multiple viable replacement options** when a player gets voted off.",
        "",
        "**Goal:** When someone is voted off and teams need to replace them, there should NOT be "
        "one obvious player everyone wants. Multiple options at different price points should be viable.",
        "",
        "---",
        "",
        "## How Price Changes Work",
        "",
        "### Update Formula",
        "",
        "After each episode:",
        "",
        "1. **Points earned** — Each contestant gets points for: survival, immunity, vote matched, etc.",
        "2. **Relative performance** — Compare each player's points to the episode average.",
        "3. **Price delta (demand-based)** — `(points - avg) / range × reactivity`",
        "   - Strong performers (above avg): demand up → price increases",
        "   - Weak performers (below avg): demand down → price decreases",
        "4. **No diversity compression** — Prices stay differentiated by performance (compression = 0).",
        "5. **No season inflation** — merge_price_multiplier = 1.0; prices reflect demand only.",
        "6. **Fixed bounds** — price_min/max stay constant (no scaling when inflation disabled).",
        "",
        "### Key Parameters",
        "",
        "| Parameter | Value | Effect |",
        "|-----------|-------|--------|",
        f"| price_reactivity | {analysis.get('dynamic_config', {}).get('price_reactivity', 0.05)} | Max % price move per episode |",
        f"| diversity_compression (base→late) | {analysis.get('dynamic_config', {}).get('diversity_compression_base', 0)}→{analysis.get('dynamic_config', {}).get('diversity_compression_late', 0)} | 0 = demand-based differentiation only |",
        f"| value_tolerance (base→max) | {analysis.get('dynamic_config', {}).get('replacement_value_tolerance_base', 0.1)}→{analysis.get('dynamic_config', {}).get('replacement_value_tolerance_max', 0.18)} | Adaptive: widens when compressed or late-season |",
        f"| merge_price_multiplier | {analysis.get('dynamic_config', {}).get('merge_price_multiplier', 1.0)} | 1.0 = no inflation; demand-based only |",
        f"| merge_episodes | {analysis.get('dynamic_config', {}).get('merge_episodes', 12)} | Tribal episodes before merge |",
        f"| merge_budget | ${analysis.get('dynamic_config', {}).get('merge_budget', 1780000):,} | Budget at merge (tuned for ~70% valid) |",
        "",
        "---",
        "",
        "## Replacement Diversity Results",
        "",
        "When a player is voted off, we count how many replacement options are **viable** "
        "(within adaptive tolerance of best value, affordable with freed budget).",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Replacement events simulated | {analysis.get('replacement_events', 0):,} |",
        f"| Avg viable options per event | {analysis.get('avg_viable_replacements', 0):.1f} |",
        f"| Min viable options (worst case) | {analysis.get('min_viable_replacements', 0)} |",
        f"| % of events with 3+ viable options | {analysis.get('pct_with_3plus_viable', 0):.1f}% |",
        "",
        "---",
        "",
        "## Merge Budget Pressure (10-12 Players Left)",
        "",
        "When the season reaches merge (10-12 players remaining), prices reflect demand-based movement. "
        "We measure what % of 7-player tribe-valid combos are under budget.",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Merge events simulated | {analysis.get('merge_events', 0):,} |",
        f"| Avg % valid at merge | {analysis.get('avg_merge_valid_pct', 0):.1f}% |",
        f"| Target % valid | {analysis.get('merge_valid_pct_target', 70):.0f}% |",
        "",
        "---",
        "",
        "## Example Replacement Scenarios",
        "",
    ]

    for i, r in enumerate(analysis.get("replacement_stats", [])[:10]):
        lines.append(f"### Event {i+1}: {r.get('voted_out', '?')} voted off (Episode {r.get('episode', '?')})")
        lines.append("")
        lines.append(f"- **Viable replacements:** {r.get('viable_count', 0)}")
        lines.append(f"- **Affordable options:** {r.get('affordable_count', 0)}")
        if r.get("viable_ids"):
            lines.append(f"- **Viable picks:** {', '.join(r['viable_ids'][:8])}{'...' if len(r['viable_ids']) > 8 else ''}")
        lines.append("")

    lines.extend([
        "---",
        "",
        "## Price Evolution (Sample Scenario)",
        "",
    ])
    for pe in analysis.get("price_evolution", [])[:5]:
        ep = pe.get("episode", 0)
        sp = pe.get("sample_prices", {})
        if sp:
            lines.append(f"**After Episode {ep}:** " + ", ".join(f"{c}=${p:,}" for c, p in list(sp.items())[:5]) + "")
    lines.extend([
        "",
        "---",
        "",
        "## Price Change Formula Example",
        "",
        "When a player wins individual immunity (+5 pts) and another gets vote matched (+2 pts) while the tribe loses immunity (-1):",
        "",
        "- **Immunity winner:** pts = 5, avg ≈ 1.5 → delta_norm positive → price goes **up**",
        "- **Vote matched:** pts = 2, avg ≈ 1.5 → delta_norm slightly positive → price goes **up** slightly",
        "- **Tribe lost immunity:** pts = -1, avg ≈ 1.5 → delta_norm negative → price goes **down**",
        "- **Voted out:** pts = -8 (e.g.), avg ≈ 1.5 → delta_norm very negative → price drops (but they're removed from pool)",
        "",
        "Demand-based pricing: each player moves independently based on performance; no universal inflation or compression.",
        "",
        "---",
        "",
        "## Edge Cases",
        "",
        "- **0 affordable:** When a cheap player is voted off, budget freed is low. If all remaining players cost more, no one is affordable. Consider: minimum replacement budget, or price floors.",
        "- **0 viable:** When one player dominates value (pts/price), no one else is within tolerance. Adaptive tolerance widens when compressed or late-season.",
        "",
        "---",
        "",
        "## Findings",
        "",
        "1. **Demand-based pricing** — Prices move each episode based on performance (immunity, vote matched, etc.); strong performers rise, weak fall.",
        "2. **Differentiation** — No compression; prices stay differentiated by performance rather than clustering.",
        "3. **Replacement diversity** — When someone is voted off, the system aims for 3+ viable replacement options.",
        "4. **Adaptive value tolerance** — Widens when prices are highly compressed or in late-season states, reducing degenerate 'one obvious pick' outcomes while preserving scarcity and budget pressure.",
        "5. **Edge cases preserved** — Impossible immediate replacement (0 affordable) remains; forces meaningful tradeoff decisions rather than auto-fills.",
        "6. **No inflation** — Prices reflect demand only; no universal rise by merge.",
        "",
    ])
    return "\n".join(lines)


def main():
    base = Path(__file__).parent.parent.parent
    output_dir = base / "output" / "simulation"

    print("Running Dynamic Pricing Simulation...")
    analysis = run_dynamic_pricing_simulation(
        num_scenarios=50,
        rosters_per_scenario=100,
        seed=42,
        output_dir=output_dir,
    )

    print("\n" + "=" * 50)
    print("DYNAMIC PRICING SUMMARY")
    print("=" * 50)
    print(f"Replacement events: {analysis['replacement_events']}")
    print(f"Avg viable options: {analysis['avg_viable_replacements']:.1f}")
    print(f"% with 3+ viable: {analysis['pct_with_3plus_viable']:.1f}%")
    print(f"Merge events (10-12 players): {analysis['merge_events']}")
    print(f"Avg merge valid %: {analysis['avg_merge_valid_pct']:.1f}% (target: {analysis['merge_valid_pct_target']:.0f}%)")


if __name__ == "__main__":
    main()
