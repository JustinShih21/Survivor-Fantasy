"""
Enumerates and samples valid roster combinations under budget and tribe constraints.
Used to count total team options and to sample diverse rosters for simulation.
"""

import random
from itertools import combinations
from typing import Dict, List, Any, Optional, Tuple


def get_tribe_map(contestants: List[Dict]) -> Dict[str, str]:
    """Map contestant ID to starting tribe."""
    return {c["id"]: c["starting_tribe"] for c in contestants}


def is_valid_roster(
    roster: Tuple[str, ...],
    prices: Dict[str, int],
    budget: int,
    tribe_map: Dict[str, str],
    roster_min: int = 5,
    roster_max: int = 7,
) -> bool:
    """
    Check if a roster is valid: 5-7 players, min 1 per tribe, under budget.
    """
    if not (roster_min <= len(roster) <= roster_max):
        return False
    tribes_represented = set(tribe_map.get(c, "") for c in roster)
    if len(tribes_represented) < 3:
        return False
    cost = sum(prices.get(c, 0) for c in roster)
    return cost <= budget


def count_tribe_valid_combos(
    contestants: List[Dict],
    roster_min: int = 7,
    roster_max: int = 7,
) -> int:
    """
    Count all tribe-valid roster combinations (min 1 per tribe) without budget filter.
    Used to compute merge_valid_pct = valid_under_budget / total_tribe_valid.
    """
    all_ids = [c["id"] for c in contestants]
    tribe_map = get_tribe_map(contestants)
    count = 0
    for size in range(roster_min, roster_max + 1):
        for combo in combinations(all_ids, size):
            tribes_represented = set(tribe_map.get(c, "") for c in combo)
            if len(tribes_represented) >= 3:
                count += 1
    return count


def count_valid_rosters(
    contestants: List[Dict],
    prices: Dict[str, int],
    budget: int,
    roster_min: int = 5,
    roster_max: int = 7,
) -> Dict[str, int]:
    """
    Count all valid roster combinations (roster_min to roster_max players, min 1 per tribe, under budget).
    Returns dict with total and per-size breakdown.
    """
    all_ids = [c["id"] for c in contestants]
    tribe_map = get_tribe_map(contestants)

    sizes = list(range(roster_min, roster_max + 1))
    counts = {s: 0 for s in sizes}
    for size in sizes:
        for combo in combinations(all_ids, size):
            if is_valid_roster(combo, prices, budget, tribe_map, roster_min, roster_max):
                counts[size] += 1

    result = {"total": sum(counts.values())}
    for s in sizes:
        result[f"size_{s}"] = counts[s]
    return result


def sample_valid_rosters(
    contestants: List[Dict],
    prices: Dict[str, int],
    budget: int,
    n: int,
    seed: Optional[int] = None,
    roster_min: int = 5,
    roster_max: int = 7,
) -> List[List[str]]:
    """
    Sample n unique valid rosters. Uses rejection sampling with deduplication.
    Returns list of rosters (each roster is a list of contestant IDs).
    """
    if seed is not None:
        random.seed(seed)
    all_ids = [c["id"] for c in contestants]
    tribe_map = get_tribe_map(contestants)
    seen: set = set()
    rosters: List[List[str]] = []

    max_attempts = n * 500  # Avoid infinite loop
    attempts = 0
    while len(rosters) < n and attempts < max_attempts:
        size = roster_min if roster_min == roster_max else random.randint(roster_min, roster_max)
        combo = tuple(sorted(random.sample(all_ids, size)))
        if combo in seen:
            attempts += 1
            continue
        if is_valid_roster(combo, prices, budget, tribe_map, roster_min, roster_max):
            seen.add(combo)
            rosters.append(list(combo))
        attempts += 1

    return rosters


def compute_combo_cost_percentiles(
    contestants: List[Dict],
    prices: Dict[str, int],
    roster_min: int = 7,
    roster_max: int = 7,
    percentiles: Optional[List[float]] = None,
) -> Dict[str, float]:
    """
    Compute cost percentiles across ALL tribe-valid combos (no budget filter).
    Used to calibrate prices so a target % of combos are under budget.
    """
    if percentiles is None:
        percentiles = [0.5, 0.75, 0.9]
    all_ids = [c["id"] for c in contestants]
    tribe_map = get_tribe_map(contestants)
    costs: List[int] = []

    for size in range(roster_min, roster_max + 1):
        for combo in combinations(all_ids, size):
            tribes_represented = set(tribe_map.get(c, "") for c in combo)
            if len(tribes_represented) < 3:
                continue
            cost = sum(prices.get(c, 0) for c in combo)
            costs.append(cost)

    if not costs:
        return {f"p{int(p*100)}": 0 for p in percentiles}

    costs_sorted = sorted(costs)
    n = len(costs_sorted)
    result = {}
    for p in percentiles:
        idx = min(int(n * p), n - 1) if n > 0 else 0
        result[f"p{int(p*100)}"] = costs_sorted[idx]
    return result


def enumerate_valid_rosters(
    contestants: List[Dict],
    prices: Dict[str, int],
    budget: int,
    roster_min: int = 5,
    roster_max: int = 7,
    max_rosters: Optional[int] = None,
) -> List[List[str]]:
    """
    Enumerate all valid rosters (or up to max_rosters if set).
    Use when total count is manageable; for large counts, use sample_valid_rosters.
    """
    all_ids = [c["id"] for c in contestants]
    tribe_map = get_tribe_map(contestants)
    rosters: List[List[str]] = []

    for size in [5, 6, 7]:
        for combo in combinations(all_ids, size):
            if is_valid_roster(combo, prices, budget, tribe_map, roster_min, roster_max):
                rosters.append(list(combo))
                if max_rosters is not None and len(rosters) >= max_rosters:
                    return rosters
    return rosters
