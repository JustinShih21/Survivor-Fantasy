"""
Generates random Survivor season scenarios for Monte Carlo simulation.
Uses research-based probabilities from config/probabilities.yaml.
Supports: 24 contestants, tribe swap at 16/17, merge at 12/11.
"""

import random
from typing import Dict, List, Any, Optional, Tuple


def load_probabilities(config_dir) -> Dict:
    """Load probability config."""
    import yaml
    from pathlib import Path
    path = Path(config_dir) / "probabilities.yaml"
    if path.exists():
        with open(path) as f:
            return yaml.safe_load(f)
    return {}


def _build_dynamic_season_structure(
    swap_at: int,
    merge_at: int,
) -> List[Dict]:
    """
    Build episode structure: phase, immunity_type, tribal.
    swap_at: 16 or 17 (players left when we swap to 2 tribes)
    merge_at: 12 or 11 (players left when we merge to 1 tribe)
    """
    episodes = []
    ep_id = 1
    remaining = 24

    # Phase 1: 3 tribes until swap_at
    elims_phase1 = 24 - swap_at  # 7 or 8
    for _ in range(elims_phase1):
        episodes.append({
            "id": ep_id,
            "phase": "pre_merge",
            "immunity_type": "team",
            "immunity_teams": 3,
            "reward_type": "team",
            "reward_teams": 3,
            "tribal": True,
            "final_tribal": False,
        })
        ep_id += 1
        remaining -= 1

    # Phase 2: 2 tribes until merge_at
    elims_phase2 = swap_at - merge_at  # 4, 5, 5, or 6
    for _ in range(elims_phase2):
        episodes.append({
            "id": ep_id,
            "phase": "swap",
            "immunity_type": "team",
            "immunity_teams": 2,
            "reward_type": "team",
            "reward_teams": 2,
            "tribal": True,
            "final_tribal": False,
        })
        ep_id += 1
        remaining -= 1

    # Phase 3: 1 tribe (merge) until final 3
    elims_phase3 = merge_at - 3  # 8 or 9
    for _ in range(elims_phase3):
        episodes.append({
            "id": ep_id,
            "phase": "post_merge",
            "immunity_type": "individual",
            "reward_type": "individual",
            "tribal": True,
            "final_tribal": False,
        })
        ep_id += 1
        remaining -= 1

    # Finale
    episodes.append({
        "id": ep_id,
        "phase": "post_merge",
        "tribal": False,
        "final_tribal": True,
    })
    return episodes


def generate_scenario(
    contestants: List[Dict],
    season_template: List[Dict],
    seed: Optional[int] = None,
    probabilities: Optional[Dict] = None,
    config_dir: Optional[object] = None,
) -> List[Dict[str, Any]]:
    """
    Generate a full season of episode outcomes using research-based probabilities.
    24 contestants, tribe swap at 16/17, merge at 12/11.
    Returns list of episode outcome dicts.
    """
    if seed is not None:
        random.seed(seed)

    if probabilities is None and config_dir is not None:
        probabilities = load_probabilities(config_dir)
    probabilities = probabilities or {}

    idol_cfg = probabilities.get("idols", {})
    clue_cfg = probabilities.get("clues", {})
    adv_cfg = probabilities.get("advantages", {})
    pocket_cfg = probabilities.get("voted_out_pocket", {})
    vote_cfg = probabilities.get("vote_counts", {})
    matched_cfg = probabilities.get("vote_matched", {})

    contestant_ids = [c["id"] for c in contestants]
    contestant_map = {c["id"]: c for c in contestants}

    # 50% swap at 16, 50% at 17
    swap_at = 16 if random.random() < 0.5 else 17
    # 50% merge at 12, 50% at 11
    merge_at = 12 if random.random() < 0.5 else 11

    season_episodes = _build_dynamic_season_structure(swap_at, merge_at)
    tribal_episode_indices = [
        i for i, ep in enumerate(season_episodes)
        if ep.get("tribal", True) and not ep.get("final_tribal", False)
    ]

    # Starting tribes: 3 tribes of 8
    tribes = {
        "Tribe A": contestant_ids[:8],
        "Tribe B": contestant_ids[8:16],
        "Tribe C": contestant_ids[16:24],
    }

    # Boot order: weighted by survival_bias
    weights = [contestant_map[c].get("survival_bias", 0.5) for c in contestant_ids]
    boot_order = random.choices(contestant_ids, weights=weights, k=len(contestant_ids))
    boot_order = list(dict.fromkeys(boot_order))
    while len(boot_order) < len(contestant_ids):
        remaining = [c for c in contestant_ids if c not in boot_order]
        boot_order.extend(random.sample(remaining, len(remaining)))

    # Idol finds: 3-6 per season
    num_idols = random.randint(
        idol_cfg.get("finds_per_season_min", 3),
        idol_cfg.get("finds_per_season_max", 6),
    )
    idol_find_episodes = sorted(
        random.sample(tribal_episode_indices, min(num_idols, len(tribal_episode_indices)))
    )
    idol_finders = random.sample(contestant_ids, num_idols)

    # Idol plays: mix of success and failure
    success_rate = idol_cfg.get("play_success_rate", 0.55)
    idol_play_events = []  # (ep_idx, finder_id, success: bool)
    for i in range(num_idols):
        finder = idol_finders[i % len(idol_finders)]
        find_ep = idol_find_episodes[i % len(idol_find_episodes)]
        later_eps = [j for j in tribal_episode_indices if j > find_ep]
        if later_eps:
            play_ep = random.choice(later_eps)
            success = random.random() < success_rate
            idol_play_events.append((play_ep, finder, success))
    idol_play_events.sort(key=lambda x: x[0])

    # Clue reads: 1-4 per season
    num_clues = random.randint(
        clue_cfg.get("reads_per_season_min", 1),
        clue_cfg.get("reads_per_season_max", 4),
    )
    clue_episodes = (
        random.sample(tribal_episode_indices, min(num_clues, len(tribal_episode_indices)))
        if num_clues > 0
        else []
    )

    # Advantage plays: 0-2 per season
    num_adv = random.randint(
        adv_cfg.get("successful_plays_per_season_min", 0),
        adv_cfg.get("successful_plays_per_season_max", 2),
    )
    adv_play_episodes = (
        sorted(random.sample(tribal_episode_indices, min(num_adv, len(tribal_episode_indices))))
        if num_adv > 0
        else []
    )
    adv_players = random.sample(contestant_ids, num_adv) if num_adv > 0 else []
    # Advantage find episodes: before each play
    adv_find_episodes = []
    for play_ep in adv_play_episodes:
        earlier = [j for j in tribal_episode_indices if j < play_ep]
        adv_find_episodes.append(random.choice(earlier) if earlier else play_ep)

    idol_holders = set()
    for ep_idx, finder in zip(idol_find_episodes, idol_finders):
        idol_holders.add(finder)

    active = set(contestant_ids)
    boot_index = 0
    episode_outcomes = []
    elims_since_start = 0

    for ep_idx, ep_template in enumerate(season_episodes):
        ep_id = ep_template.get("id", ep_idx + 1)
        phase = ep_template.get("phase", "pre_merge")

        # Update tribe assignments at swap and merge
        if elims_since_start == 24 - swap_at and ep_idx > 0:
            # Tribe swap: 2 tribes, random assignment
            remaining_list = list(active)
            random.shuffle(remaining_list)
            mid = len(remaining_list) // 2
            tribes = {
                "Tribe A": remaining_list[:mid],
                "Tribe B": remaining_list[mid:],
            }
        elif elims_since_start == 24 - merge_at and ep_idx > 0:
            # Merge: 1 tribe
            tribes = {"Merge": list(active)}

        if ep_template.get("final_tribal"):
            remaining = list(active)
            random.shuffle(remaining)
            final_three = remaining[:3] if len(remaining) >= 3 else remaining
            winner = random.choice(final_three)
            episode_outcomes.append({
                "episode_id": ep_id,
                "phase": phase,
                "tribal": False,
                "final_tribal": True,
                "immunity_type": "individual",
                "reward_type": "individual",
                "active_contestants": list(active),
                "final_three": final_three,
                "winner": winner,
                "contestant_tribes": tribes,
                "vote_targets": {},
                "votes_received": {},
                "idol_votes_nullified": 0,
                "confessional_counts": {},
                "inclusion_in_plan": [],
                "safety_statement": [],
                "vote_info_correct": [],
                "advantage_info_correct": [],
                "initiates_strategic": [],
                "kept_commitment": [],
                "swing_label": [],
                "named_target_survives": [],
                "key_contributor": [],
                "costs_challenge": [],
                "confessionals_4_6": [],
                "confessionals_7_plus": [],
                "episode_narrator": None,
            })
            break

        voted_out = None
        if ep_template.get("tribal", True) and boot_index < len(boot_order):
            voted_out = boot_order[boot_index]
            if voted_out in active:
                active.remove(voted_out)
                boot_index += 1
                elims_since_start += 1
                idol_holders.discard(voted_out)

        # Vote matched
        vote_matched = []
        if voted_out and active:
            voters = list(active)
            pct_min = matched_cfg.get("pct_of_voters_min", 0.65)
            pct_max = matched_cfg.get("pct_of_voters_max", 0.95)
            num_matched = random.randint(
                max(1, int(len(voters) * pct_min)),
                min(len(voters), int(len(voters) * pct_max)),
            )
            vote_matched = random.sample(voters, num_matched) if num_matched <= len(voters) else voters

        # Strategic player: one from vote_matched, weighted by survival_bias
        strategic_player = []
        if voted_out and vote_matched:
            weights = [contestant_map.get(c, {}).get("survival_bias", 0.5) for c in vote_matched]
            strategic_player = [random.choices(vote_matched, weights=weights, k=1)[0]]

        # Vote count
        if phase in ("pre_merge", "swap"):
            voted_out_votes = (
                random.randint(
                    vote_cfg.get("pre_merge_min", 4),
                    vote_cfg.get("pre_merge_max", 7),
                )
                if voted_out
                else 0
            )
        else:
            voted_out_votes = (
                random.randint(
                    vote_cfg.get("post_merge_min", 5),
                    vote_cfg.get("post_merge_max", 10),
                )
                if voted_out
                else 0
            )

        voted_out_pocket = 0
        if voted_out:
            if random.random() < pocket_cfg.get("probability_has_item", 0.17):
                voted_out_pocket = 2 if random.random() < pocket_cfg.get("probability_two_items", 0.03) else 1

        # Team immunity/reward
        immunity_teams = ep_template.get("immunity_teams", 3)
        reward_teams = ep_template.get("reward_teams", 3)
        team_immunity_results = {}
        team_reward_results = {}
        if phase in ("pre_merge", "swap") and immunity_teams >= 2:
            tribe_names = list(tribes.keys())[:immunity_teams]
            placements = list(range(1, immunity_teams + 1))
            random.shuffle(placements)
            for i, t in enumerate(tribe_names):
                team_immunity_results[t] = placements[i]
            placements = list(range(1, reward_teams + 1))
            random.shuffle(placements)
            for i, t in enumerate(tribe_names[:reward_teams]):
                team_reward_results[t] = placements[i] if i < len(placements) else reward_teams

        # Individual immunity (post-merge)
        individual_winner = None
        if ep_template.get("immunity_type") == "individual" and active:
            weights = [contestant_map.get(c, {}).get("challenge_ability", 0.5) for c in active]
            individual_winner = random.choices(list(active), weights=weights, k=1)[0]

        # Clue readers and clue finder
        clue_readers = []
        clue_finder = None
        if ep_idx in clue_episodes and active:
            n = random.randint(
                clue_cfg.get("readers_per_clue_min", 1),
                clue_cfg.get("readers_per_clue_max", 2),
            )
            clue_readers = random.sample(list(active), min(n, len(active)))
            clue_finder = clue_readers[0] if clue_readers else None

        # Idol finder (this episode)
        idol_finder = None
        if ep_idx in idol_find_episodes and active:
            idx = idol_find_episodes.index(ep_idx)
            if idx < len(idol_finders) and idol_finders[idx] in active:
                idol_finder = idol_finders[idx]

        # Idol played (success or failure)
        idol_played = []
        idol_failed = []
        for play_ep, finder, success in idol_play_events:
            if play_ep == ep_idx and finder in active and voted_out:
                idol_holders.discard(finder)
                if success:
                    idol_played = [finder]
                else:
                    idol_failed = [finder]
                break

        # Advantage played and advantage finder
        advantage_played = []
        advantage_finder = None
        if ep_idx in adv_play_episodes and adv_players and active and voted_out:
            idx = adv_play_episodes.index(ep_idx)
            if idx < len(adv_players) and adv_players[idx] in active:
                advantage_played = [adv_players[idx]]
        if ep_idx in adv_find_episodes and adv_players and active:
            idx = adv_find_episodes.index(ep_idx)
            if idx < len(adv_players) and adv_players[idx] in active:
                advantage_finder = adv_players[idx]

        # Vote targets: who each contestant voted for
        vote_targets = {}
        votes_received = {}
        if voted_out and active:
            voters = list(active)
            vote_matched_set = set(vote_matched)
            minority = [c for c in voters if c not in vote_matched_set]
            for cid in voters:
                if cid in vote_matched_set:
                    vote_targets[cid] = voted_out
                else:
                    # Minority voted for someone else (not voted_out)
                    others = [x for x in voters if x != voted_out and x != cid]
                    vote_targets[cid] = random.choice(others) if others else voted_out
            votes_received[voted_out] = voted_out_votes
            for cid in voters:
                if cid != voted_out:
                    votes_received[cid] = 0

        # Idol votes nullified: when idol played, votes that would have gone to idol holder
        idol_votes_nullified = 0
        if idol_played and voted_out:
            idol_votes_nullified = voted_out_votes  # proxy for votes nullified

        # Confessional counts: placeholder distribution (0-3 most, 4-7 for few)
        active_list = list(active)
        if voted_out:
            active_list = list(active) + [voted_out]
        confessional_counts = {}
        for cid in active_list:
            if random.random() < 0.15:
                confessional_counts[cid] = random.randint(4, 7)
            elif random.random() < 0.25:
                confessional_counts[cid] = random.randint(4, 6)
            else:
                confessional_counts[cid] = random.randint(0, 3)

        # BPS placeholder fields (schema only, default empty)
        bps_placeholders = {
            "inclusion_in_plan": [],
            "safety_statement": [],
            "vote_info_correct": [],
            "advantage_info_correct": [],
            "initiates_strategic": [],
            "kept_commitment": [],
            "swing_label": [],
            "named_target_survives": [],
            "key_contributor": [],
            "costs_challenge": [],
            "confessionals_4_6": [],
            "confessionals_7_plus": [],
            "episode_narrator": None,
        }

        episode_outcomes.append({
            "episode_id": ep_id,
            "phase": phase,
            "tribal": ep_template.get("tribal", True),
            "immunity_type": ep_template.get("immunity_type", "team"),
            "reward_type": ep_template.get("reward_type", "team"),
            "immunity_teams": immunity_teams,
            "reward_teams": reward_teams,
            "active_contestants": list(active),
            "survived": list(active) if voted_out else [],
            "voted_out": voted_out,
            "vote_matched": vote_matched,
            "strategic_player": strategic_player,
            "voted_out_votes": voted_out_votes,
            "voted_out_pocket_items": voted_out_pocket,
            "team_immunity_results": team_immunity_results,
            "team_reward_results": team_reward_results,
            "contestant_tribes": tribes,
            "individual_immunity_winner": individual_winner,
            "clue_readers": clue_readers,
            "idol_played": idol_played,
            "idol_failed": idol_failed,
            "advantage_played": advantage_played,
            "idol_finder": idol_finder,
            "clue_finder": clue_finder,
            "advantage_finder": advantage_finder,
            "vote_targets": vote_targets,
            "votes_received": votes_received,
            "idol_votes_nullified": idol_votes_nullified,
            "confessional_counts": confessional_counts,
            **bps_placeholders,
        })

    return episode_outcomes
