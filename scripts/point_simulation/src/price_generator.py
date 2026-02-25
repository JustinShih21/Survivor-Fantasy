"""
Price generator for Survivor fantasy.
Runs Monte Carlo to estimate expected points per contestant, then maps to prices.
"""

from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Any, Optional

from .point_calculator import calculate_roster_points
from .scenario_generator import generate_scenario


def compute_expected_points_per_contestant(
    contestants: List[Dict],
    season_template: List[Dict],
    scoring_config: Dict[str, Any],
    config_dir: Path,
    num_runs: int = 2000,
    seed: int = 42,
) -> Dict[str, float]:
    """
    Run Monte Carlo: for each contestant, score them as a solo roster across many scenarios.
    Return average points per contestant.
    """
    contestant_ids = [c["id"] for c in contestants]
    points_by_contestant = defaultdict(list)

    for run_idx in range(num_runs):
        scenario_seed = seed + run_idx * 1000
        episode_outcomes = generate_scenario(
            contestants,
            season_template,
            seed=scenario_seed,
            config_dir=config_dir,
        )

        for cid in contestant_ids:
            # Score solo roster (just this contestant)
            result = calculate_roster_points(
                [cid],
                episode_outcomes,
                scoring_config,
            )
            points_by_contestant[cid].append(result["total"])

    return {
        cid: sum(pts) / len(pts)
        for cid, pts in points_by_contestant.items()
    }


def expected_points_to_prices(
    expected_points: Dict[str, float],
    pricing_config: Dict[str, Any],
) -> Dict[str, int]:
    """
    Map expected points to dollar prices with wider variation.
    - Non-linear curve: top players much more expensive, bottom cheaper
    - Scale so top N by expected points ≈ target (N from roster size)
    """
    price_min = pricing_config.get("price_min", 40000)
    price_max = pricing_config.get("price_max", 260000)
    roster_max = pricing_config.get("roster_max", 7)
    target_top7 = pricing_config.get("target_top7_sum", 980000)
    target_top5 = pricing_config.get("target_top5_sum", target_top7 * 0.95)  # fallback
    curve = pricing_config.get("price_curve", 1.8)

    if not expected_points:
        return {}

    eps = list(expected_points.values())
    e_min = min(eps)
    e_max = max(eps)
    e_range = e_max - e_min if e_max > e_min else 1.0

    # Non-linear mapping: norm^curve pushes top players higher, bottom lower
    raw_prices = {}
    for cid, e in expected_points.items():
        norm = (e - e_min) / e_range
        norm = max(0, min(1, norm))
        curved = norm ** curve
        raw_prices[cid] = price_min + curved * (price_max - price_min)

    # Sort by expected points descending
    sorted_ids = sorted(
        expected_points.keys(),
        key=lambda x: expected_points[x],
        reverse=True,
    )
    # Scale by top N sum (7-player mode uses top 7)
    n = min(roster_max, len(sorted_ids))
    target = target_top7 if roster_max == 7 else target_top5
    top_n_sum = sum(raw_prices[cid] for cid in sorted_ids[:n])
    if top_n_sum > 0:
        scale = target / top_n_sum
        raw_prices = {cid: p * scale for cid, p in raw_prices.items()}

    # Round to increment and clamp
    increment = pricing_config.get("price_increment", 5000)
    prices = {}
    for cid, p in raw_prices.items():
        clamped = max(price_min, min(price_max, p))
        rounded = round(clamped / increment) * increment
        prices[cid] = int(max(price_min, min(price_max, rounded)))

    return prices
