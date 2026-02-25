#!/usr/bin/env python3
"""
Export seed data for Survivor Fantasy prototype.
Outputs contestants, prices, episode_outcomes, and scoring_config to app/seed/.
"""

import json
import sys
from pathlib import Path

import yaml

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from src.scenario_generator import generate_scenario


def load_config(config_dir: Path) -> tuple:
    """Load scoring, season, contestant configs."""
    with open(config_dir / "scoring.yaml") as f:
        scoring = yaml.safe_load(f)
    with open(config_dir / "season_template.yaml") as f:
        season = yaml.safe_load(f)
    with open(config_dir / "contestants_s50.yaml") as f:
        contestants = yaml.safe_load(f)["contestants"]
    return scoring, season["episodes"], contestants


def main():
    config_dir = Path(__file__).parent / "config"
    output_dir = Path(__file__).parent.parent.parent / "app" / "seed"
    output_dir.mkdir(parents=True, exist_ok=True)

    scoring, season_template, contestants = load_config(config_dir)

    # Use precomputed prices from pricing_analysis.json if available
    pricing_path = Path(__file__).parent.parent / "output" / "simulation" / "pricing_analysis.json"
    if pricing_path.exists():
        with open(pricing_path) as f:
            pricing_data = json.load(f)
        prices = pricing_data["prices"]
        print(f"Using precomputed prices from {pricing_path}")
    else:
        # Fallback: compute prices (slower)
        from src.price_generator import (
            compute_expected_points_per_contestant,
            expected_points_to_prices,
        )
        with open(config_dir / "pricing.yaml") as f:
            pricing_config = yaml.safe_load(f)
        expected_points = compute_expected_points_per_contestant(
            contestants, season_template, scoring, config_dir, num_runs=200, seed=42
        )
        prices = expected_points_to_prices(expected_points, pricing_config)
        print("Computed prices from Monte Carlo")

    # Build contestants with prices
    def photo_url(c):
        return c.get("photo_url") or f"https://api.dicebear.com/7.x/avataaars/png?seed={c['id']}&size=80"

    contestants_with_prices = []
    for c in contestants:
        contestants_with_prices.append({
            "id": c["id"],
            "name": c["name"],
            "starting_tribe": c["starting_tribe"],
            "pre_merge_price": prices.get(c["id"], 150000),
            "photo_url": photo_url(c),
        })

    # Generate deterministic episode outcomes (seed=42)
    episode_outcomes = generate_scenario(
        contestants,
        season_template,
        seed=42,
        config_dir=config_dir,
    )

    # Limit to first 6 pre-merge episodes for prototype demo
    pre_merge_only = [ep for ep in episode_outcomes if ep.get("phase") in ("pre_merge", "swap")][:6]
    if not pre_merge_only:
        pre_merge_only = episode_outcomes[:6]

    # Write outputs
    with open(output_dir / "contestants.json", "w") as f:
        json.dump(contestants_with_prices, f, indent=2)

    with open(output_dir / "episode_outcomes.json", "w") as f:
        json.dump(pre_merge_only, f, indent=2)

    with open(output_dir / "prices.json", "w") as f:
        json.dump(prices, f, indent=2)

    with open(output_dir / "scoring_config.json", "w") as f:
        json.dump(scoring, f, indent=2)

    # Also write seed SQL for Supabase migration (app/supabase/migrations)
    migrations_dir = output_dir.parent / "supabase" / "migrations"
    migrations_dir.mkdir(parents=True, exist_ok=True)
    seed_sql_path = migrations_dir / "00002_seed_data.sql"

    with open(seed_sql_path, "w") as f:
        f.write("-- Seed data for Survivor Fantasy prototype\n\n")
        # Contestants
        f.write("INSERT INTO contestants (id, name, starting_tribe, pre_merge_price, photo_url) VALUES\n")
        rows = [
            f"  ('{c['id']}', '{c['name'].replace(chr(39), chr(39)+chr(39))}', '{c['starting_tribe']}', {c['pre_merge_price']}, '{c.get('photo_url', '').replace(chr(39), chr(39)+chr(39))}')"
            for c in contestants_with_prices
        ]
        f.write(",\n".join(rows) + "\nON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, starting_tribe = EXCLUDED.starting_tribe, pre_merge_price = EXCLUDED.pre_merge_price, photo_url = EXCLUDED.photo_url;\n\n")
        # Episode outcomes
        f.write("INSERT INTO episode_outcomes (episode_id, phase, outcome) VALUES\n")
        ep_rows = []
        for ep in pre_merge_only:
            outcome_json = json.dumps(ep).replace("'", "''")
            ep_rows.append(f"  ({ep['episode_id']}, '{ep['phase']}', '{outcome_json}'::jsonb)")
        f.write(",\n".join(ep_rows) + "\nON CONFLICT (episode_id) DO UPDATE SET phase = EXCLUDED.phase, outcome = EXCLUDED.outcome;\n\n")
        # Scoring config
        scoring_json = json.dumps(scoring).replace("'", "''")
        f.write(f"INSERT INTO scoring_config (id, config) VALUES ('default', '{scoring_json}'::jsonb)\n")
        f.write("ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config;\n")

    print(f"Exported to {output_dir}:")
    print(f"  - contestants.json ({len(contestants_with_prices)} contestants)")
    print(f"  - episode_outcomes.json ({len(pre_merge_only)} episodes)")
    print(f"  - prices.json")
    print(f"  - scoring_config.json")


if __name__ == "__main__":
    main()
