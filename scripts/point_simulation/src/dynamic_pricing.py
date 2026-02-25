"""
Dynamic pricing: episode-reactive price updates.
Prices change based on recent episode performance so replacement scenarios
have multiple viable options (no single obvious pick).
"""

from typing import Dict, List, Any, Optional


def _contestant_went_to_tribal(cid: str, ep: Dict[str, Any]) -> bool:
    """
    True if contestant went to tribal council (their tribe lost immunity).
    Only the tribe that loses immunity attends tribal council.
    Post-merge: everyone attends tribal (individual immunity).
    """
    if ep.get("immunity_type") == "individual":
        return True  # Post-merge: everyone attends tribal
    team_result = ep.get("team_immunity_results", {})
    tribes = ep.get("contestant_tribes", {})
    immunity_teams = ep.get("immunity_teams", 3)
    for tribe, result in team_result.items():
        if cid in tribes.get(tribe, []):
            # 3-team: only last (result 3) goes to tribal; 2-team: only 2nd (result 2) goes
            losing_result = 2 if immunity_teams == 2 else immunity_teams
            return result == losing_result
    return False


def calculate_contestant_episode_points(
    cid: str,
    ep: Dict[str, Any],
    scoring_config: Dict[str, Any],
) -> float:
    """
    Calculate points earned by a single contestant in a single episode.
    Used for episode-reactive price updates.
    """
    pts = 0.0
    phase = ep.get("phase", "pre_merge")
    survival = scoring_config.get("survival", {})
    pre_merge_tribal = survival.get("pre_merge_tribal", survival.get("pre_merge", 1))
    post_merge = survival.get("post_merge", 3)

    if cid not in ep.get("active_contestants", []) and ep.get("voted_out") != cid:
        return 0.0

    # Survival: pre-merge/swap tribal = pre_merge_tribal; post-merge = post_merge
    if ep.get("tribal", True) and not ep.get("final_tribal", False):
        if cid in ep.get("survived", []):
            pts += pre_merge_tribal if phase in ("pre_merge", "swap") else post_merge

    # Team immunity
    if ep.get("immunity_type") == "team":
        team_result = ep.get("team_immunity_results", {})
        for tribe, result in team_result.items():
            if cid in ep.get("contestant_tribes", {}).get(tribe, []):
                if result == 1:
                    pts += scoring_config["team_immunity"]["first"]
                elif result == 2 and ep.get("immunity_teams", 3) == 3:
                    pts += scoring_config["team_immunity"]["second_three_team"]
                elif result == 2 and ep.get("immunity_teams", 2) == 2:
                    pts += scoring_config["team_immunity"].get("second_two_team", 0)
                else:
                    pts += scoring_config["team_immunity"]["last_or_second_two_team"]
                break

    # Team reward
    if ep.get("reward_type") == "team":
        reward_result = ep.get("team_reward_results", {})
        for tribe, result in reward_result.items():
            if cid in ep.get("contestant_tribes", {}).get(tribe, []):
                if result == 1:
                    pts += scoring_config["team_reward"]["first"]
                elif result == 2 and ep.get("reward_teams", 3) == 3:
                    pts += scoring_config["team_reward"]["second_three_team"]
                elif result == 2 and ep.get("reward_teams", 2) == 2:
                    pts += scoring_config["team_reward"].get("second_two_team", 0)
                break

    # Individual immunity
    if ep.get("immunity_type") == "individual" and ep.get("individual_immunity_winner") == cid:
        pts += scoring_config["individual_immunity"]

    # Vote matched (only if contestant went to tribal - their tribe lost immunity)
    if _contestant_went_to_tribal(cid, ep) and cid in ep.get("vote_matched", []):
        pts += scoring_config["tribal"].get("vote_matched", 1)

    # Correct target vote
    correct_target = scoring_config.get("tribal", {}).get("correct_target_vote", 0)
    if correct_target and ep.get("voted_out") and ep.get("vote_targets", {}).get(cid) == ep.get("voted_out"):
        pts += correct_target

    # Zero votes received
    zero_votes = scoring_config.get("tribal", {}).get("zero_votes_received", 0)
    if zero_votes and _contestant_went_to_tribal(cid, ep) and ep.get("votes_received", {}).get(cid, 0) == 0:
        pts += zero_votes

    # Voted out
    if ep.get("voted_out") == cid:
        base = scoring_config["tribal"]["voted_out_base"]
        per_vote = scoring_config["tribal"]["voted_out_per_vote"]
        pocket_mult = scoring_config["tribal"]["voted_out_pocket_multiplier"]
        items = ep.get("voted_out_pocket_items", 0)
        votes = ep.get("voted_out_votes", 0)
        pts += base * (pocket_mult ** items) + (per_vote * votes)

    # Confessionals
    confessionals = scoring_config.get("confessionals", {})
    if confessionals:
        cc = ep.get("confessional_counts", {}).get(cid, 0)
        if 4 <= cc <= 6:
            pts += confessionals.get("range_4_6", 0)
        if cc >= 7:
            pts += confessionals.get("range_7_plus", 0)

    # Advantages
    if cid in ep.get("clue_readers", []):
        pts += scoring_config["advantages"].get("clue_read", 2)
    if cid in ep.get("advantage_played", []):
        pts += scoring_config["advantages"].get("advantage_play", 5)
    if cid in ep.get("idol_played", []):
        per_vote = scoring_config["advantages"].get("idol_play_per_vote")
        if per_vote is not None:
            nullified = ep.get("idol_votes_nullified", ep.get("voted_out_votes", 0))
            pts += per_vote * nullified
        else:
            pts += scoring_config["advantages"].get("idol_play", 8)
    if cid in ep.get("idol_failed", []):
        pts += scoring_config["advantages"]["idol_failure"]
    if _contestant_went_to_tribal(cid, ep) and cid in ep.get("strategic_player", []):
        pts += scoring_config["advantages"]["strategic_player"]

    if ep.get("quit") == cid:
        pts += scoring_config["other"]["quit"]

    if ep.get("final_tribal"):
        if cid in ep.get("final_three", []):
            pts += scoring_config["placement"]["final_tribal"]
            if cid == ep.get("winner"):
                pts += scoring_config["placement"]["win_season"]

    return pts


def update_prices_from_episode(
    prior_prices: Dict[str, int],
    episode_outcome: Dict[str, Any],
    scoring_config: Dict[str, Any],
    config: Dict[str, Any],
    episode_index: Optional[int] = None,
    tribal_episode_count: Optional[int] = None,
) -> Dict[str, int]:
    """
    Update prices based on episode performance (demand-based).
    - Strong performers (above avg points): demand up → price goes up
    - Weak performers (below avg): demand down → price goes down
    - No universal inflation: prices differentiate by performance only.
    - Diversity compression (if > 0): pulls toward median; set to 0 for full differentiation.
    - Season inflation (if merge_multiplier > 1): optional; 1.0 = disabled.
    - Eliminated (voted-out) contestants: prices are frozen; no further changes after they leave.
    """
    reactivity = config.get("price_reactivity", 0.05)
    base_min = config.get("price_min", 80000)
    base_max = config.get("price_max", 260000)
    increment = config.get("price_increment", 2500)
    compression_base = config.get("diversity_compression_base", config.get("diversity_compression", 0))
    compression_late = config.get("diversity_compression_late", 0)

    active = set(episode_outcome.get("active_contestants", []))
    voted_out = episode_outcome.get("voted_out")
    if voted_out:
        active.add(voted_out)  # Include voted-out for points calc

    # Dynamic diversity compression: scale up as season progresses (fewer players left)
    remaining = len(active)
    season_progress = max(0, (24 - remaining) / 20) if remaining <= 24 else 0  # 0 early, ~1 late
    diversity_compression = compression_base + (compression_late - compression_base) * season_progress

    # Points earned this episode
    ep_pts = {}
    for cid in active:
        ep_pts[cid] = calculate_contestant_episode_points(cid, episode_outcome, scoring_config)

    if not ep_pts:
        return dict(prior_prices)

    avg_pts = sum(ep_pts.values()) / len(ep_pts)
    pts_range = max(1.0, max(ep_pts.values()) - min(ep_pts.values()))

    # Price delta: (pts - avg) / pts_range * reactivity
    # Clamp delta to avoid wild swings
    new_prices = {}
    for cid, prior in prior_prices.items():
        if cid not in ep_pts:
            new_prices[cid] = prior
            continue
        pts = ep_pts[cid]
        delta_norm = (pts - avg_pts) / pts_range if pts_range > 0 else 0
        delta_norm = max(-1, min(1, delta_norm))
        # Apply reactivity: price moves by up to ±reactivity
        change_pct = delta_norm * reactivity
        new_val = prior * (1 + change_pct)
        new_prices[cid] = new_val

    # Eliminated contestants: freeze prices (no changes after voted out)
    # active = contestants who participated this episode (still in game + voted out this ep)
    eliminated = {cid for cid in prior_prices if cid not in active}

    # Diversity compression: pull prices toward median (only for active contestants)
    if diversity_compression > 0:
        vals = [new_prices[c] for c in active if new_prices.get(c, 0) > 0]
        if vals:
            median = sorted(vals)[len(vals) // 2]
            for cid in active:
                new_prices[cid] = new_prices[cid] * (1 - diversity_compression) + median * diversity_compression

    # Season inflation: only apply when merge_multiplier > 1 (1.0 = disabled, demand-based only)
    # Only for active contestants; eliminated prices stay frozen
    merge_episodes = config.get("merge_episodes", 12)
    merge_multiplier = config.get("merge_price_multiplier", 1.0)
    tribals = tribal_episode_count if tribal_episode_count is not None else (episode_index + 1 if episode_index is not None else 1)
    if voted_out and merge_episodes > 0 and merge_multiplier > 1:
        inflation_factor = merge_multiplier ** (1.0 / merge_episodes)
        for cid in active:
            new_prices[cid] = new_prices[cid] * inflation_factor

    # Bounds: scale with season progress only when inflation is active; otherwise fixed
    # Only for active contestants; eliminated prices stay frozen
    progress = min(1.0, tribals / merge_episodes) if merge_episodes > 0 and merge_multiplier > 1 else 0
    price_min = base_min * (1 + progress)
    price_max = base_max * (1 + progress)

    # Build result: active contestants get rounded/clamped; eliminated keep prior price
    result = {}
    for cid, prior in prior_prices.items():
        if cid in eliminated:
            result[cid] = prior  # Frozen: no change after voted out
        else:
            p = new_prices[cid]
            rounded = round(p / increment) * increment
            result[cid] = int(max(price_min, min(price_max, rounded)))

    return result


def _adaptive_value_tolerance(
    affordable_prices: List[int],
    remaining_count: int,
    config: Dict[str, Any],
) -> float:
    """
    Widen value tolerance when: (1) prices are highly compressed, or (2) late-season.
    Preserves strategic tension while reducing "one obvious pick" outcomes.
    """
    base = config.get("replacement_value_tolerance_base", 0.10)
    max_tol = config.get("replacement_value_tolerance_max", 0.18)
    late_threshold = config.get("late_season_threshold", 12)
    compressed_ratio = config.get("highly_compressed_ratio", 0.35)

    tolerance = base
    if not affordable_prices:
        return base

    price_range = max(affordable_prices) - min(affordable_prices)
    median = sorted(affordable_prices)[len(affordable_prices) // 2]
    compression_ratio = (price_range / median) if median > 0 else 1.0

    # Widen when highly compressed (similar prices = harder to differentiate)
    if compression_ratio < compressed_ratio:
        tolerance = min(max_tol, base + 0.05)

    # Widen when late-season (fewer options = need broader "viable" band)
    if remaining_count < late_threshold:
        tolerance = min(max_tol, tolerance + 0.04)

    return min(max_tol, tolerance)


def count_viable_replacements(
    replacement_pool: List[str],
    prices: Dict[str, int],
    expected_points: Dict[str, float],
    budget_available: int,
    value_tolerance: Optional[float] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Count how many replacement options are "viable" (within value_tolerance of best).
    Value tolerance is adaptive: widens when prices are compressed or late-season.
    """
    affordable = [(c, prices.get(c, 0), expected_points.get(c, 0)) for c in replacement_pool if prices.get(c, 0) <= budget_available]
    if not affordable:
        return {"count": 0, "best_value": 0, "viable": [], "all_options": 0, "affordable_count": 0}

    # Adaptive value tolerance when config provided
    if value_tolerance is None and config:
        affordable_prices = [p for _, p, _ in affordable]
        value_tolerance = _adaptive_value_tolerance(
            affordable_prices, len(replacement_pool), config
        )
    elif value_tolerance is None:
        value_tolerance = 0.10

    # Value = expected_pts / price
    with_value = [(c, p, ep, (ep / p) if p > 0 else 0) for c, p, ep in affordable]
    best_value = max(v for _, _, _, v in with_value)
    threshold = best_value * (1 - value_tolerance)
    viable = [(c, p, ep, v) for c, p, ep, v in with_value if v >= threshold]

    return {
        "count": len(viable),
        "best_value": best_value,
        "viable": [(c, p, round(ep, 1), round(v, 4)) for c, p, ep, v in viable],
        "all_options": len(affordable),
        "affordable_count": len(affordable),
        "value_tolerance_used": value_tolerance,
    }
