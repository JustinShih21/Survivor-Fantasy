#!/usr/bin/env python3
"""
Episode Trace Simulation: Week-by-week view of prices, vote-offs, and fantasy team impact.
Runs a single scenario with full episode-by-episode trace. Shows:
- Who was voted out each week
- Price changes (before → after) for all contestants
- How each sample fantasy team's roster evolves (replacements, budget)
- Episode points earned by each team
"""

import sys
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
    active = set(ep_outcome.get("active_contestants", []))
    voted_out = ep_outcome.get("voted_out")
    if voted_out:
        active.add(voted_out)
    candidates = [c for c in roster if c in active]
    if not candidates:
        return None
    return max(candidates, key=lambda c: expected_points.get(c, 0))


def roster_episode_points(
    roster: list,
    ep: dict,
    scoring: dict,
    captain: str | None,
) -> float:
    """Points earned by this roster in this single episode."""
    pts = 0.0
    for cid in roster:
        p = calculate_contestant_episode_points(cid, ep, scoring)
        if captain and cid == captain:
            p *= CAPTAIN_MULTIPLIER
        pts += p
    return pts


def run_episode_trace(
    scenario_seed: int = 42,
    num_teams: int = 3,
    output_dir: Path = None,
) -> dict:
    config_dir = Path(__file__).parent / "config"
    scoring, season_template, contestants, pricing_config, dynamic_config = load_config(config_dir)
    budget = pricing_config.get("budget", 1_000_000)
    update_config = dict(pricing_config, **dynamic_config)
    add_player_penalty = scoring.get("other", {}).get("add_player_penalty", -10)

    # Contestant name lookup
    id_to_name = {c["id"]: c.get("name", c["id"]) for c in contestants}

    print("Computing expected points and prices...")
    expected_points = compute_expected_points_per_contestant(
        contestants, season_template, scoring, config_dir, num_runs=500, seed=scenario_seed
    )
    prices = expected_points_to_prices(expected_points, pricing_config)

    # Calibrate for target valid % (same as full sim)
    from src.roster_enumerator import compute_combo_cost_percentiles
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

    print("Generating rosters...")
    all_rosters = generate_budget_rosters_for_simulation(
        contestants, prices, budget, expected_points,
        num_per_strategy=5, seed=scenario_seed,
        roster_min=7, roster_max=7,
    )

    # Pick sample teams: one value, one mid_tier, one random (first of each)
    strategies_wanted = ["value", "mid_tier", "random"]
    sample_rosters = []
    seen = set()
    for r in all_rosters:
        if r["strategy"] in strategies_wanted and r["strategy"] not in seen:
            seen.add(r["strategy"])
            sample_rosters.append(r)
            if len(sample_rosters) >= num_teams:
                break

    if len(sample_rosters) < num_teams:
        sample_rosters = all_rosters[:num_teams]

    print("Generating scenario...")
    episode_outcomes = generate_scenario(
        contestants, season_template, seed=scenario_seed, config_dir=config_dir
    )

    # Build price history and episode trace
    scenario_prices = dict(prices)
    price_history = [dict(scenario_prices)]
    episode_trace = []

    # Initialize team states: (roster, replace_style, cumulative_pts, replacement_penalty)
    teams = []
    for r in sample_rosters:
        teams.append({
            "strategy": r["strategy"],
            "fixed": {"roster": list(r["roster"]), "pts": 0.0, "penalty": 0},
            "replace": {"roster": list(r["roster"]), "pts": 0.0, "penalty": 0},
        })

    ph_idx = 0
    for ep_idx, ep in enumerate(episode_outcomes):
        if ep.get("final_tribal"):
            break

        voted_out = ep.get("voted_out")
        phase = ep.get("phase", "pre_merge")

        # Prices before this tribal
        prices_before = dict(price_history[ph_idx])

        # Update prices if tribal
        if voted_out:
            scenario_prices = update_prices_from_episode(
                scenario_prices, ep, scoring, update_config,
                episode_index=ep_idx, tribal_episode_count=ep_idx + 1,
            )
            price_history.append(dict(scenario_prices))
            prices_after = dict(scenario_prices)
        else:
            prices_after = dict(prices_before)

        # Price changes (only for players who moved)
        price_changes = []
        for cid in prices_before:
            before = prices_before.get(cid, 0)
            after = prices_after.get(cid, 0)
            if before != after:
                delta = after - before
                pct = 100 * (after - before) / before if before else 0
                price_changes.append((cid, before, after, delta, pct))

        # Sort by abs delta descending
        price_changes.sort(key=lambda x: abs(x[3]), reverse=True)

        # Team updates and episode points
        team_updates = []
        for t in teams:
            for style, data in [("fixed", t["fixed"]), ("replace", t["replace"])]:
                roster = data["roster"]
                captain = pick_captain(roster, expected_points, ep)
                ep_pts = roster_episode_points(roster, ep, scoring, captain)
                data["pts"] += ep_pts

                replacement_info = None
                if voted_out and voted_out in roster and style == "replace":
                    prices_at_ep = price_history[min(ph_idx + 1, len(price_history) - 1)]
                    budget_freed = price_history[ph_idx].get(voted_out, 100000)
                    remaining = list(ep.get("active_contestants", []))
                    ep_remaining = {c: expected_points.get(c, 0) for c in remaining}
                    viable = count_viable_replacements(
                        remaining, prices_at_ep, ep_remaining, budget_freed, config=update_config
                    )
                    if viable["count"] > 0 and viable["viable"]:
                        best = viable["viable"][0]
                        new_player = best[0]
                        data["roster"] = [c for c in roster if c != voted_out]
                        data["roster"].append(new_player)
                        data["penalty"] += add_player_penalty
                        data["pts"] += add_player_penalty  # Include in cumulative
                        replacement_info = {
                            "out": voted_out,
                            "in": new_player,
                            "budget_freed": budget_freed,
                            "viable_count": viable["count"],
                            "add_penalty": add_player_penalty,
                        }

                team_updates.append({
                    "strategy": t["strategy"],
                    "style": style,
                    "roster": list(data["roster"]),
                    "episode_pts": ep_pts,
                    "cumulative_pts": data["pts"],
                    "replacement": replacement_info,
                    "captain": captain,
                })

        if voted_out:
            ph_idx += 1

        episode_trace.append({
            "episode": ep_idx + 1,
            "phase": phase,
            "voted_out": voted_out,
            "prices_before": prices_before,
            "prices_after": prices_after,
            "price_changes": price_changes,
            "team_updates": team_updates,
        })

    # Add penalty already applied incrementally for replace; fixed has none. Sell has no penalty.
    return {
        "episode_trace": episode_trace,
        "add_player_penalty": add_player_penalty,
        "teams": teams,
        "id_to_name": id_to_name,
        "episode_outcomes": episode_outcomes,
        "price_history": price_history,
        "initial_prices": prices,
        "budget": budget,
        "scenario_seed": scenario_seed,
    }


def generate_trace_report(trace_data: dict) -> str:
    initial_prices = trace_data["initial_prices"]
    budget = trace_data.get("budget", 1_000_000)

    seed = trace_data.get("scenario_seed", 42)
    add_penalty = trace_data.get("add_player_penalty", -10)
    lines = [
        "# Episode Trace: Week-by-Week Simulation",
        "",
        f"**Scenario seed:** {seed} — run `python run_episode_trace_simulation.py --seed 123` for different outcomes.",
        "",
        "Shows how prices change, who gets voted out, and how fantasy teams are affected.",
        f"**Transfer rules:** Sell = no penalty; Add = {add_penalty} pts per add.",
        "",
        "---",
        "",
        "## Sample Teams (Final Results)",
        "",
    ]

    for t in trace_data["teams"]:
        strat = t["strategy"]
        fixed_roster = t["fixed"]["roster"]
        fixed_pts = t["fixed"]["pts"]
        rep_roster = t["replace"]["roster"]
        rep_pts = t["replace"]["pts"]
        id_to_name = trace_data["id_to_name"]
        # Initial cost (from first roster state - same for both at start)
        init_cost = sum(initial_prices.get(c, 0) for c in fixed_roster)
        lines.append(f"### {strat}")
        lines.append("")
        lines.append(f"- **Fixed (no replace):** {fixed_pts:.0f} pts — roster: {', '.join(fixed_roster)}")
        lines.append(f"- **Replace (when viable):** {rep_pts:.0f} pts — roster: {', '.join(rep_roster)}")
        lines.append(f"- Initial cost: ${init_cost:,} / ${budget:,} budget")
        lines.append("")

    lines.extend([
        "---",
        "",
        "## Week-by-Week Breakdown",
        "",
    ])

    for et in trace_data["episode_trace"]:
        ep_num = et["episode"]
        phase = et["phase"]
        voted_out = et["voted_out"]
        id_to_name = trace_data["id_to_name"]

        lines.append(f"### Episode {ep_num} ({phase})")
        lines.append("")

        if voted_out:
            name = id_to_name.get(voted_out, voted_out)
            lines.append(f"**Voted out:** {voted_out} ({name})")
            lines.append("")

            # Price changes
            changes = et["price_changes"]
            if changes:
                lines.append("**Price changes:**")
                lines.append("")
                lines.append("| Contestant | Before | After | Change |")
                lines.append("|------------|--------|-------|--------|")
                for cid, before, after, delta, pct in changes[:12]:  # Top 12 movers
                    name = id_to_name.get(cid, cid)
                    sign = "+" if delta >= 0 else ""
                    lines.append(f"| {cid} ({name}) | ${before:,} | ${after:,} | {sign}{delta:,} ({sign}{pct:.1f}%) |")
                if len(changes) > 12:
                    lines.append(f"| ... | ({len(changes) - 12} more) | | |")
                lines.append("")

        # Team impact
        lines.append("**Fantasy team impact:**")
        lines.append("")
        lines.append("| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |")
        lines.append("|------|-------|-------------|-----------|---------------|---------|")

        for tu in et["team_updates"]:
            strat = tu["strategy"]
            style = tu["style"]
            ep_pts = tu["episode_pts"]
            cum = tu["cumulative_pts"]
            rep = tu["replacement"]
            captain = tu["captain"] or "—"

            if rep:
                penalty = rep.get("add_penalty", -10)
                change = f"{rep['out']} → {rep['in']} (${rep['budget_freed']:,} freed, {rep['viable_count']} viable, add penalty {penalty})"
            else:
                change = "—"

            lines.append(f"| {strat} | {style} | {ep_pts:.1f} | {cum:.1f} | {change} | {captain} |")

        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Run episode trace simulation (week-by-week view)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for scenario")
    parser.add_argument("--teams", type=int, default=3, help="Number of sample teams")
    args = parser.parse_args()

    output_dir = Path(__file__).parent.parent.parent / "output" / "simulation"
    output_dir.mkdir(parents=True, exist_ok=True)

    trace_data = run_episode_trace(scenario_seed=args.seed, num_teams=args.teams)
    report = generate_trace_report(trace_data)

    out_path = output_dir / "EPISODE_TRACE_REPORT.md"
    with open(out_path, "w") as f:
        f.write(report)

    print(f"Report saved to {out_path}")

    # Also save JSON for programmatic use
    json_path = output_dir / "episode_trace_data.json"
    import json
    # Serialize trace (convert to JSON-serializable)
    def _serialize(obj):
        if isinstance(obj, (list, dict)):
            return obj
        if hasattr(obj, "__dict__"):
            return str(obj)
        return obj
    json_data = {
        "episode_trace": [
            {
                "episode": e["episode"],
                "phase": e["phase"],
                "voted_out": e["voted_out"],
                "price_changes": [(c[0], c[1], c[2], c[3], c[4]) for c in e["price_changes"]],
                "team_updates": [
                    {
                        "strategy": u["strategy"],
                        "style": u["style"],
                        "episode_pts": u["episode_pts"],
                        "cumulative_pts": u["cumulative_pts"],
                        "replacement": u["replacement"],
                        "captain": u["captain"],
                    }
                    for u in e["team_updates"]
                ],
            }
            for e in trace_data["episode_trace"]
        ],
        "teams": [
            {
                "strategy": t["strategy"],
                "fixed": {"roster": t["fixed"]["roster"], "pts": t["fixed"]["pts"]},
                "replace": {"roster": t["replace"]["roster"], "pts": t["replace"]["pts"]},
            }
            for t in trace_data["teams"]
        ],
        "id_to_name": trace_data["id_to_name"],
        "add_player_penalty": trace_data.get("add_player_penalty", -10),
    }
    with open(json_path, "w") as f:
        json.dump(json_data, f, indent=2)
    print(f"Data saved to {json_path}")


if __name__ == "__main__":
    main()
