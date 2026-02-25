"""
Generates roster combinations for simulation.
Pre-merge: 7 contestants (2 per tribe + 1 wild card)
Post-merge: 5 contestants (from remaining pool)
"""

import random
from typing import Dict, List, Any, Optional


def get_tribes(contestants: List[Dict]) -> Dict[str, List[str]]:
    """Get contestant IDs grouped by starting tribe."""
    tribes = {}
    for c in contestants:
        tribe = c["starting_tribe"]
        if tribe not in tribes:
            tribes[tribe] = []
        tribes[tribe].append(c["id"])
    return tribes


def generate_pre_merge_roster(
    contestants: List[Dict],
    strategy: str = "random",
    seed: Optional[int] = None,
) -> List[str]:
    """
    Generate a valid pre-merge roster (7 contestants: 2 per tribe + 1 wild card).
    
    strategy: "random", "challenge_beast", "idol_hunter", "utr", "balanced"
    """
    if seed is not None:
        random.seed(seed)
    
    tribes = get_tribes(contestants)
    tribe_names = list(tribes.keys())
    
    if len(tribe_names) < 3:
        raise ValueError("Need at least 3 tribes")
    
    roster = []
    
    # Pick 2 from each tribe
    for tribe in tribe_names:
        pool = tribes[tribe]
        if strategy == "challenge_beast":
            sorted_pool = sorted(
                [(c, next((x["challenge_ability"] for x in contestants if x["id"] == c), 0.5)) 
                 for c in pool],
                key=lambda x: x[1],
                reverse=True,
            )
            picks = [x[0] for x in sorted_pool[:2]]
        elif strategy == "idol_hunter":
            sorted_pool = sorted(
                [(c, next((x["idol_likelihood"] for x in contestants if x["id"] == c), 0.3)) 
                 for c in pool],
                key=lambda x: x[1],
                reverse=True,
            )
            picks = [x[0] for x in sorted_pool[:2]]
        elif strategy == "utr":
            sorted_pool = sorted(
                [(c, next((x["survival_bias"] for x in contestants if x["id"] == c), 0.5)) 
                 for c in pool],
                key=lambda x: x[1],
                reverse=True,
            )
            picks = [x[0] for x in sorted_pool[:2]]
        else:  # random or balanced
            picks = random.sample(pool, min(2, len(pool)))
        
        roster.extend(picks)
    
    # Wild card (1 from any tribe)
    all_ids = [c["id"] for c in contestants]
    remaining = [c for c in all_ids if c not in roster]
    
    if strategy == "challenge_beast" and remaining:
        sorted_rem = sorted(
            [(c, next((x["challenge_ability"] for x in contestants if x["id"] == c), 0.5)) for c in remaining],
            key=lambda x: x[1],
            reverse=True,
        )
        roster.append(sorted_rem[0][0])
    elif strategy == "idol_hunter" and remaining:
        sorted_rem = sorted(
            [(c, next((x["idol_likelihood"] for x in contestants if x["id"] == c), 0.3)) for c in remaining],
            key=lambda x: x[1],
            reverse=True,
        )
        roster.append(sorted_rem[0][0])
    elif remaining:
        roster.append(random.choice(remaining))
    
    return roster[:7]


def generate_post_merge_roster(
    remaining_contestants: List[str],
    episode_outcomes: List[Dict],
    strategy: str = "greedy",
    seed: Optional[int] = None,
) -> List[str]:
    """
    Generate post-merge roster (5 from remaining).
    Greedy = pick 5 with highest points so far (simplified: random for now).
    """
    if seed is not None:
        random.seed(seed)
    
    if len(remaining_contestants) <= 5:
        return remaining_contestants
    
    if strategy == "greedy":
        return random.sample(remaining_contestants, 5)  # Simplified: random
    else:
        return random.sample(remaining_contestants, 5)


def generate_rosters_for_simulation(
    contestants: List[Dict],
    num_per_strategy: int = 20,
    seed: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Generate multiple rosters across strategies for simulation.
    Returns list of { roster, strategy } dicts.
    """
    rosters = []
    strategies = ["random", "challenge_beast", "idol_hunter", "utr", "balanced"]
    
    for strategy in strategies:
        for i in range(num_per_strategy):
            r = generate_pre_merge_roster(contestants, strategy, seed=(seed + i * 100) if seed is not None else None)
            rosters.append({"roster": r, "strategy": strategy})
    
    return rosters


def _generate_stars_and_scrubs(
    contestants: List[Dict],
    prices: Dict[str, int],
    budget: int,
    expected_points: Dict[str, float],
    seed: Optional[int],
    roster_max: int = 7,
) -> List[str]:
    """Pick 2 expensive stars, then fill with cheapest to roster_max (min 1 per tribe)."""
    if seed is not None:
        random.seed(seed)
    tribes = get_tribes(contestants)
    tribe_names = list(tribes.keys())

    # Pick 2 stars: max expected that fit; tie-break randomly
    all_ids = [c["id"] for c in contestants]
    stars = []
    for _ in range(2):
        remaining = [c for c in all_ids if c not in stars]
        cost_so_far = sum(prices.get(c, 0) for c in stars)
        affordable = [c for c in remaining if prices.get(c, 0) <= budget - cost_so_far]
        if not affordable:
            break
        best_ep = max(expected_points.get(c, 0) for c in affordable)
        ties = [c for c in affordable if expected_points.get(c, 0) == best_ep]
        stars.append(random.choice(ties))

    used = set(stars)
    roster = list(stars)
    remaining_budget = budget - sum(prices.get(c, 0) for c in roster)

    # Fill with cheapest, ensuring min 1 per tribe
    for tribe in tribe_names:
        if sum(1 for c in roster if c in tribes[tribe]) >= 1:
            continue
        pool = [c for c in tribes[tribe] if c not in used]
        if not pool:
            continue
        by_price = sorted(pool, key=lambda x: prices.get(x, 0))
        for cid in by_price:
            if cid in used:
                continue
            p = prices.get(cid, 0)
            if p <= remaining_budget:
                roster.append(cid)
                used.add(cid)
                remaining_budget -= p
                break

    # Fill remaining slots (up to roster_max) with cheapest
    all_ids = [c["id"] for c in contestants]
    remaining = [c for c in all_ids if c not in roster and prices.get(c, 0) <= remaining_budget]
    by_price = sorted(remaining, key=lambda x: prices.get(x, 0))
    for cid in by_price:
        if len(roster) >= roster_max:
            break
        p = prices.get(cid, 0)
        if p <= remaining_budget:
            roster.append(cid)
            remaining_budget -= p

    return roster[:roster_max]


def _generate_premium_roster(
    contestants: List[Dict],
    prices: Dict[str, int],
    budget: int,
    expected_points: Dict[str, float],
    target_size: int,
    seed: Optional[int],
    roster_max: int = 7,
) -> List[str]:
    """Pick target_size premium players, then fill to roster_max (min 1 per tribe)."""
    if seed is not None:
        random.seed(seed)
    tribes = get_tribes(contestants)
    tribe_names = list(tribes.keys())

    # Must have 1 from each tribe - pick best affordable from each
    roster = []
    for tribe in tribe_names:
        pool = tribes[tribe]
        remaining_budget = budget - sum(prices.get(c, 0) for c in roster)
        affordable = [c for c in pool if prices.get(c, 0) <= remaining_budget]
        if not affordable:
            affordable = [min(pool, key=lambda x: prices.get(x, 0))]
        best_ep = max(expected_points.get(x, 0) for x in affordable)
        ties = [x for x in affordable if expected_points.get(x, 0) == best_ep]
        best = random.choice(ties)
        roster.append(best)
    used = set(roster)
    remaining_budget = budget - sum(prices.get(c, 0) for c in roster)

    # Fill remaining slots with best by expected that fit (tie-break randomly)
    all_ids = [c["id"] for c in contestants]
    candidates = [c for c in all_ids if c not in used]

    fill_target = max(target_size, roster_max)
    while len(roster) < fill_target and candidates:
        affordable = [c for c in candidates if prices.get(c, 0) <= remaining_budget]
        if not affordable:
            break
        best_ep = max(expected_points.get(c, 0) for c in affordable)
        ties = [c for c in affordable if expected_points.get(c, 0) == best_ep]
        cid = random.choice(ties)
        roster.append(cid)
        used.add(cid)
        remaining_budget -= prices.get(cid, 0)
        candidates = [c for c in candidates if c != cid]

    return roster[:roster_max]


def generate_budget_roster(
    contestants: List[Dict],
    prices: Dict[str, int],
    budget: int,
    expected_points: Optional[Dict[str, float]] = None,
    strategy: str = "max_expected",
    seed: Optional[int] = None,
    roster_min: int = 5,
    roster_max: int = 7,
) -> List[str]:
    """
    Generate a valid pre-merge roster under budget constraint.
    Rules: min 1 per tribe, roster_min to roster_max players (e.g. exactly 7).
    
    strategy: "max_expected", "value", "balanced", "mid_tier", "stars_and_scrubs",
              "five_premium", "six_premium", "random"
    """
    if seed is not None:
        random.seed(seed)
    
    tribes = get_tribes(contestants)
    tribe_names = list(tribes.keys())
    
    if len(tribe_names) < 3:
        raise ValueError("Need at least 3 tribes")
    
    expected_points = expected_points or {}

    if strategy == "stars_and_scrubs":
        return _generate_stars_and_scrubs(contestants, prices, budget, expected_points, seed, roster_max)
    if strategy == "five_premium":
        return _generate_premium_roster(contestants, prices, budget, expected_points, 5, seed, roster_max)
    if strategy == "six_premium":
        return _generate_premium_roster(contestants, prices, budget, expected_points, 6, seed, roster_max)

    def cost(roster: List[str]) -> int:
        return sum(prices.get(c, 0) for c in roster)

    # For mid_tier: only consider players in middle 50% of expected points
    all_eps = sorted(expected_points.values()) if expected_points else [0]
    mid_low = all_eps[len(all_eps) // 4] if all_eps else 0
    mid_high = all_eps[3 * len(all_eps) // 4] if all_eps else 100

    def score_for_pick(cid: str) -> float:
        ep = expected_points.get(cid, 0)
        p = prices.get(cid, 1)
        if strategy == "max_expected":
            return ep
        elif strategy == "value":
            return (ep / p) if p > 0 else 0
        elif strategy == "balanced":
            value = ep / p if p > 0 else 0
            return value + 0.001 * ep
        elif strategy == "mid_tier":
            if mid_low <= ep <= mid_high:
                return ep / p if p > 0 else 0
            return -1000
        else:
            return random.random()

    # Pick min 1 from each tribe, then fill up to roster_max
    roster = []
    for tribe in tribe_names:
        pool = tribes[tribe]
        candidates = [(c, prices.get(c, 0), score_for_pick(c)) for c in pool]
        affordable = [x for x in candidates if x[1] <= budget - cost(roster)]
        if not affordable:
            by_price = sorted(candidates, key=lambda x: x[1])
            roster.append(by_price[0][0])
        else:
            if strategy == "random":
                pick = random.choice(affordable)
            else:
                best_score = max(x[2] for x in affordable)
                ties = [x for x in affordable if x[2] == best_score]
                pick = random.choice(ties)
            roster.append(pick[0])

    # Fill remaining slots (up to roster_max) from any tribe; must reach at least roster_min
    all_ids = [c["id"] for c in contestants]
    remaining = [c for c in all_ids if c not in roster]
    remaining_budget = budget - cost(roster)
    candidates = [(c, prices.get(c, 0), score_for_pick(c)) for c in remaining if prices.get(c, 0) <= remaining_budget]

    while len(roster) < roster_max and candidates:
        if strategy == "random":
            pick = random.choice(candidates)
        else:
            best_score = max(x[2] for x in candidates)
            ties = [x for x in candidates if x[2] == best_score]
            pick = random.choice(ties)
        roster.append(pick[0])
        remaining_budget -= pick[1]
        candidates = [(c, p, s) for c, p, s in candidates if c != pick[0] and p <= remaining_budget]

    return roster[:roster_max]


def generate_budget_rosters_for_simulation(
    contestants: List[Dict],
    prices: Dict[str, int],
    budget: int,
    expected_points: Dict[str, float],
    num_per_strategy: int = 20,
    seed: Optional[int] = None,
    roster_min: int = 5,
    roster_max: int = 7,
) -> List[Dict[str, Any]]:
    """
    Generate multiple budget-constrained rosters across strategies.
    Returns list of { roster, strategy, total_cost } dicts.
    """
    rosters = []
    strategies = [
        "max_expected", "value", "balanced", "mid_tier",
        "stars_and_scrubs", "five_premium", "six_premium", "random",
    ]
    
    for strategy in strategies:
        for i in range(num_per_strategy):
            r = generate_budget_roster(
                contestants,
                prices,
                budget,
                expected_points=expected_points,
                strategy=strategy,
                seed=(seed + i * 100) if seed is not None else None,
                roster_min=roster_min,
                roster_max=roster_max,
            )
            total_cost = sum(prices.get(c, 0) for c in r)
            rosters.append({
                "roster": r,
                "strategy": strategy,
                "total_cost": total_cost,
            })
    
    return rosters
