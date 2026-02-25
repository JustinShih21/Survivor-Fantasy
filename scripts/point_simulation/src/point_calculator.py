"""
Point calculator for Survivor fantasy scoring.
Computes points for a roster given episode outcomes.
Returns granular event-level breakdown for detailed reporting.
Supports optional captaincy: captain gets 2x points for chosen episodes.
"""

from typing import Dict, List, Any, Optional

from .dynamic_pricing import (
    calculate_contestant_episode_points,
    _contestant_went_to_tribal,
)


# All event types for granular tracking
EVENT_TYPES = [
    "survival_pre_merge",
    "survival_post_merge",
    "survival_swap",
    "team_immunity_first",
    "team_immunity_second_three",
    "team_immunity_second_two",
    "team_immunity_last",
    "team_reward_first",
    "team_reward_second_three",
    "team_reward_second_two",
    "individual_immunity",
    "vote_matched",
    "correct_target_vote",
    "zero_votes_received",
    "voted_out",
    "confessionals",
    "episode_rank_bonus",
    "clue_read",
    "advantage_play",
    "idol_play",
    "idol_failure",
    "strategic_player",
    "final_tribal",
    "win_season",
    "quit",
]


def _init_event_breakdown() -> Dict[str, Dict[str, int]]:
    """Initialize event breakdown with count and points for each type."""
    return {et: {"count": 0, "points": 0} for et in EVENT_TYPES}


def calculate_roster_points(
    roster: List[str],
    episode_outcomes: List[Dict[str, Any]],
    scoring_config: Dict[str, Any],
    captain_per_episode: Optional[List[Optional[str]]] = None,
) -> Dict[str, Any]:
    """
    Calculate total points and granular event-level breakdown for a roster.
    
    roster: List of contestant IDs on the user's tribe (FIXED - no replacement when voted out)
    episode_outcomes: List of outcome dicts per episode
    scoring_config: Scoring configuration from YAML
    captain_per_episode: Optional list of captain IDs per episode (captain gets 2x pts for that ep)
    
    Returns: { total, breakdown, event_breakdown, captain_bonus }
    """
    breakdown = {
        "survival": 0,
        "challenges": 0,
        "tribal": 0,
        "advantages": 0,
        "placement": 0,
        "penalties": 0,
    }
    event_breakdown = _init_event_breakdown()
    captain_multiplier = scoring_config.get("captain_multiplier", 2.0)
    captain_bonus_total = 0.0

    survival_cfg = scoring_config.get("survival", {})
    pre_merge_tribal = survival_cfg.get("pre_merge_tribal", survival_cfg.get("pre_merge", 1))
    post_merge = survival_cfg.get("post_merge", 3)

    for ep_idx, ep in enumerate(episode_outcomes):
        phase = ep.get("phase", "pre_merge")
        episode_pts_by_cid = {}  # Track pts per player this ep for captain bonus
        if phase in ("pre_merge", "swap"):
            survival_pts = pre_merge_tribal
            survival_key = "survival_pre_merge" if phase == "pre_merge" else "survival_swap"
        else:
            survival_pts = post_merge
            survival_key = "survival_post_merge"
        
        for cid in roster:
            is_voted_out_this_ep = ep.get("voted_out") == cid
            if not is_voted_out_this_ep and cid not in ep.get("active_contestants", []):
                continue

            # Points this player earns this episode (for captain bonus)
            episode_pts_by_cid[cid] = calculate_contestant_episode_points(cid, ep, scoring_config)
            
            # Survival
            if ep.get("tribal", True) and not ep.get("final_tribal", False):
                if cid in ep.get("survived", []):
                    breakdown["survival"] += survival_pts
                    event_breakdown[survival_key]["count"] += 1
                    event_breakdown[survival_key]["points"] += survival_pts
            
            # Challenges - team immunity
            if ep.get("immunity_type") == "team":
                team_result = ep.get("team_immunity_results", {})
                for tribe, result in team_result.items():
                    if cid in ep.get("contestant_tribes", {}).get(tribe, []):
                        if result == 1:
                            pts = scoring_config["team_immunity"]["first"]
                            breakdown["challenges"] += pts
                            event_breakdown["team_immunity_first"]["count"] += 1
                            event_breakdown["team_immunity_first"]["points"] += pts
                        elif result == 2 and ep.get("immunity_teams", 3) == 3:
                            pts = scoring_config["team_immunity"]["second_three_team"]
                            breakdown["challenges"] += pts
                            event_breakdown["team_immunity_second_three"]["count"] += 1
                            event_breakdown["team_immunity_second_three"]["points"] += pts
                        elif result == 2 and ep.get("immunity_teams", 2) == 2:
                            pts = scoring_config["team_immunity"].get("second_two_team", 0)
                            breakdown["challenges"] += pts
                            event_breakdown["team_immunity_second_two"]["count"] += 1
                            event_breakdown["team_immunity_second_two"]["points"] += pts
                        else:
                            pts = scoring_config["team_immunity"]["last_or_second_two_team"]
                            breakdown["challenges"] += pts
                            event_breakdown["team_immunity_last"]["count"] += 1
                            event_breakdown["team_immunity_last"]["points"] += pts
                        break
            
            # Challenges - team reward
            if ep.get("reward_type") == "team":
                reward_result = ep.get("team_reward_results", {})
                for tribe, result in reward_result.items():
                    if cid in ep.get("contestant_tribes", {}).get(tribe, []):
                        if result == 1:
                            pts = scoring_config["team_reward"]["first"]
                            breakdown["challenges"] += pts
                            event_breakdown["team_reward_first"]["count"] += 1
                            event_breakdown["team_reward_first"]["points"] += pts
                        elif result == 2 and ep.get("reward_teams", 3) == 3:
                            pts = scoring_config["team_reward"]["second_three_team"]
                            breakdown["challenges"] += pts
                            event_breakdown["team_reward_second_three"]["count"] += 1
                            event_breakdown["team_reward_second_three"]["points"] += pts
                        elif result == 2 and ep.get("reward_teams", 2) == 2:
                            pts = scoring_config["team_reward"].get("second_two_team", 0)
                            breakdown["challenges"] += pts
                            event_breakdown["team_reward_second_two"]["count"] += 1
                            event_breakdown["team_reward_second_two"]["points"] += pts
                        break
            
            # Individual immunity
            if ep.get("immunity_type") == "individual" and ep.get("individual_immunity_winner") == cid:
                pts = scoring_config["individual_immunity"]
                breakdown["challenges"] += pts
                event_breakdown["individual_immunity"]["count"] += 1
                event_breakdown["individual_immunity"]["points"] += pts
            
            # Tribal - vote matched (only if contestant went to tribal)
            if _contestant_went_to_tribal(cid, ep) and cid in ep.get("vote_matched", []):
                pts = scoring_config["tribal"].get("vote_matched", 1)
                breakdown["tribal"] += pts
                event_breakdown["vote_matched"]["count"] += 1
                event_breakdown["vote_matched"]["points"] += pts
            correct_target = scoring_config.get("tribal", {}).get("correct_target_vote", 0)
            if correct_target and ep.get("voted_out") and ep.get("vote_targets", {}).get(cid) == ep.get("voted_out"):
                breakdown["tribal"] += correct_target
                event_breakdown["correct_target_vote"]["count"] += 1
                event_breakdown["correct_target_vote"]["points"] += correct_target
            zero_votes = scoring_config.get("tribal", {}).get("zero_votes_received", 0)
            if zero_votes and _contestant_went_to_tribal(cid, ep) and ep.get("votes_received", {}).get(cid, 0) == 0:
                breakdown["tribal"] += zero_votes
                event_breakdown["zero_votes_received"]["count"] += 1
                event_breakdown["zero_votes_received"]["points"] += zero_votes

            # Voted out
            if ep.get("voted_out") == cid:
                base = scoring_config["tribal"]["voted_out_base"]
                per_vote = scoring_config["tribal"]["voted_out_per_vote"]
                pocket_mult = scoring_config["tribal"]["voted_out_pocket_multiplier"]
                items = ep.get("voted_out_pocket_items", 0)
                votes = ep.get("voted_out_votes", 0)
                penalty = base * (pocket_mult ** items) + (per_vote * votes)
                breakdown["penalties"] += penalty
                event_breakdown["voted_out"]["count"] += 1
                event_breakdown["voted_out"]["points"] += penalty
            
            # Confessionals
            confessionals = scoring_config.get("confessionals", {})
            if confessionals:
                cc = ep.get("confessional_counts", {}).get(cid, 0)
                if 4 <= cc <= 6:
                    pts = confessionals.get("range_4_6", 0)
                    breakdown["advantages"] += pts
                    event_breakdown["confessionals"]["count"] += 1
                    event_breakdown["confessionals"]["points"] += pts
                if cc >= 7:
                    pts = confessionals.get("range_7_plus", 0)
                    breakdown["advantages"] += pts
                    event_breakdown["confessionals"]["count"] += 1
                    event_breakdown["confessionals"]["points"] += pts

            # Advantages
            if cid in ep.get("clue_readers", []):
                pts = scoring_config["advantages"]["clue_read"]
                breakdown["advantages"] += pts
                event_breakdown["clue_read"]["count"] += 1
                event_breakdown["clue_read"]["points"] += pts
            if cid in ep.get("advantage_played", []):
                pts = scoring_config["advantages"]["advantage_play"]
                breakdown["advantages"] += pts
                event_breakdown["advantage_play"]["count"] += 1
                event_breakdown["advantage_play"]["points"] += pts
            if cid in ep.get("idol_played", []):
                per_vote = scoring_config["advantages"].get("idol_play_per_vote")
                if per_vote is not None:
                    nullified = ep.get("idol_votes_nullified", ep.get("voted_out_votes", 0))
                    pts = per_vote * nullified
                else:
                    pts = scoring_config["advantages"].get("idol_play", 8)
                breakdown["advantages"] += pts
                event_breakdown["idol_play"]["count"] += 1
                event_breakdown["idol_play"]["points"] += pts
            if cid in ep.get("idol_failed", []):
                pts = scoring_config["advantages"]["idol_failure"]
                breakdown["penalties"] += pts
                event_breakdown["idol_failure"]["count"] += 1
                event_breakdown["idol_failure"]["points"] += pts
            if _contestant_went_to_tribal(cid, ep) and cid in ep.get("strategic_player", []):
                pts = scoring_config["advantages"]["strategic_player"]
                breakdown["advantages"] += pts
                event_breakdown["strategic_player"]["count"] += 1
                event_breakdown["strategic_player"]["points"] += pts
            
            # Quit
            if ep.get("quit") == cid:
                pts = scoring_config["other"]["quit"]
                breakdown["penalties"] += pts
                event_breakdown["quit"]["count"] += 1
                event_breakdown["quit"]["points"] += pts

        # Captain bonus: captain gets (multiplier - 1) extra points for this episode
        if captain_per_episode and ep_idx < len(captain_per_episode):
            captain = captain_per_episode[ep_idx]
            if captain and captain in roster:
                captain_bonus_total += (captain_multiplier - 1) * episode_pts_by_cid.get(captain, 0)
        
        # Placement (final tribal)
        if ep.get("final_tribal"):
            for cid in roster:
                if cid in ep.get("final_three", []):
                    pts_ft = scoring_config["placement"]["final_tribal"]
                    breakdown["placement"] += pts_ft
                    event_breakdown["final_tribal"]["count"] += 1
                    event_breakdown["final_tribal"]["points"] += pts_ft
                    if cid == ep.get("winner"):
                        pts_win = scoring_config["placement"]["win_season"]
                        breakdown["placement"] += pts_win
                        event_breakdown["win_season"]["count"] += 1
                        event_breakdown["win_season"]["points"] += pts_win
    
    total = sum(breakdown.values()) + captain_bonus_total
    return {
        "total": total,
        "breakdown": breakdown,
        "event_breakdown": event_breakdown,
        "captain_bonus": captain_bonus_total,
        "survival": breakdown["survival"],
        "challenges": breakdown["challenges"],
        "tribal": breakdown["tribal"],
        "advantages": breakdown["advantages"],
        "placement": breakdown["placement"],
        "penalties": breakdown["penalties"],
    }
