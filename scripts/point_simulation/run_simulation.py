#!/usr/bin/env python3
"""
Survivor Fantasy Point Simulation
Runs Monte Carlo simulations to validate scoring balance.
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

import yaml

from src.point_calculator import calculate_roster_points
from src.scenario_generator import generate_scenario
from src.roster_generator import generate_rosters_for_simulation
from src.analyzer import analyze_results, generate_report


def load_config(config_dir: Path) -> tuple:
    """Load scoring, season, and contestant configs."""
    with open(config_dir / "scoring.yaml") as f:
        scoring = yaml.safe_load(f)
    with open(config_dir / "season_template.yaml") as f:
        season = yaml.safe_load(f)
    with open(config_dir / "contestants_s50.yaml") as f:
        contestants = yaml.safe_load(f)["contestants"]
    return scoring, season["episodes"], contestants


def run_simulation(
    num_runs: int = 500,
    num_rosters_per_strategy: int = 20,
    seed: int = 42,
    output_dir: Path = None,
) -> dict:
    """Run full simulation and return analysis."""
    config_dir = Path(__file__).parent / "config"
    scoring, season_template, contestants = load_config(config_dir)
    
    # Generate rosters
    rosters = generate_rosters_for_simulation(
        contestants,
        num_per_strategy=num_rosters_per_strategy,
        seed=seed,
    )
    
    results = []
    for run_idx in range(num_runs):
        scenario_seed = seed + run_idx * 1000
        episode_outcomes = generate_scenario(
            contestants,
            season_template,
            seed=scenario_seed,
            config_dir=config_dir,
        )
        
        for roster_data in rosters:
            roster = roster_data["roster"]
            strategy = roster_data["strategy"]
            
            points = calculate_roster_points(
                roster,
                episode_outcomes,
                scoring,
            )
            
            results.append({
                "roster": roster,
                "strategy": strategy,
                "total": points["total"],
                "breakdown": points["breakdown"],
                "event_breakdown": points.get("event_breakdown", {}),
                "scenario_id": run_idx,
            })
    
    analysis = analyze_results(results)
    
    # Generate report
    report = generate_report(analysis)
    
    # Save outputs
    if output_dir:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        with open(output_dir / "report.md", "w") as f:
            f.write(report)
        with open(output_dir / "SIMULATION_REPORT_READABLE.md", "w") as f:
            f.write(report)
        
        with open(output_dir / "analysis.json", "w") as f:
            # Convert for JSON (remove all_totals if too large)
            save_analysis = {k: v for k, v in analysis.items() if k != "all_totals"}
            json.dump(save_analysis, f, indent=2)
        
        print(f"Report saved to {output_dir / 'report.md'}")
        print(f"Analysis saved to {output_dir / 'analysis.json'}")
    
    return analysis


def main():
    parser = argparse.ArgumentParser(description="Survivor Fantasy Point Simulation")
    parser.add_argument("--runs", type=int, default=500, help="Number of scenario runs")
    parser.add_argument("--rosters", type=int, default=20, help="Rosters per strategy per run")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--output", "-o", type=str, default=None, help="Output directory")
    args = parser.parse_args()
    
    # Default output to survivor_fantasy/output/simulation
    if args.output is None:
        base = Path(__file__).parent.parent.parent
        args.output = base / "output" / "simulation"
    
    print(f"Running {args.runs} simulations with {args.rosters} rosters per strategy...")
    analysis = run_simulation(
        num_runs=args.runs,
        num_rosters_per_strategy=args.rosters,
        seed=args.seed,
        output_dir=args.output,
    )
    
    print("\n" + "=" * 50)
    print("QUICK SUMMARY")
    print("=" * 50)
    print(f"Average team score: {analysis['total_avg']:.1f}")
    print("\nCategory contribution:")
    for cat, pct in analysis["category_pct"].items():
        print(f"  {cat}: {pct:.1f}%")
    print("\nFull report saved to output directory.")


if __name__ == "__main__":
    main()
