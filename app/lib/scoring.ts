/**
 * Survivor Fantasy scoring engine.
 * Port of point_calculator.py and dynamic_pricing.calculate_contestant_episode_points.
 */

import type { BPSConfig } from "./bps";
import { getEpisodeRankBonuses } from "./bps";

export interface TribeEntry {
  contestant_id: string;
  is_wild_card: boolean;
  added_at_episode: number;
  /** When sold; null = still on roster. Player was on roster for episodes added_at..removed_at (inclusive). */
  removed_at_episode?: number | null;
}

export interface EpisodeOutcome {
  episode_id?: number;
  phase?: string;
  tribal?: boolean;
  final_tribal?: boolean;
  immunity_type?: string;
  reward_type?: string;
  immunity_teams?: number;
  reward_teams?: number;
  active_contestants?: string[];
  survived?: string[];
  voted_out?: string | null;
  vote_matched?: string[];
  voted_out_votes?: number;
  voted_out_pocket_items?: number;
  team_immunity_results?: Record<string, number>;
  team_reward_results?: Record<string, number>;
  contestant_tribes?: Record<string, string[]>;
  individual_immunity_winner?: string | null;
  clue_readers?: string[];
  idol_played?: string[];
  idol_failed?: string[];
  advantage_played?: string[];
  idol_finder?: string | null;
  clue_finder?: string | null;
  advantage_finder?: string | null;
  quit?: string | null;
  final_three?: string[];
  winner?: string | null;
  /** Who each contestant voted for (contestant_id -> target_id) */
  vote_targets?: Record<string, string>;
  /** Vote count received at tribal (contestant_id -> count) */
  votes_received?: Record<string, number>;
  /** Votes nullified when idol was played (for idol player) */
  idol_votes_nullified?: number;
  /** Confessional count per contestant (contestant_id -> count) */
  confessional_counts?: Record<string, number>;
  /** BPS placeholder fields (schema only, default empty) */
  inclusion_in_plan?: string[];
  safety_statement?: string[];
  vote_info_correct?: string[];
  advantage_info_correct?: string[];
  initiates_strategic?: string[];
  kept_commitment?: string[];
  swing_label?: string[];
  named_target_survives?: string[];
  key_contributor?: string[];
  costs_challenge?: string[];
  confessionals_4_6?: string[];
  confessionals_7_plus?: string[];
  episode_narrator?: string | null;
  [key: string]: unknown;
}

export interface ScoringConfig {
  survival: {
    pre_merge_no_tribal?: number;
    pre_merge_tribal: number;
    post_merge: number;
  };
  placement: { final_tribal: number; win_season: number };
  team_immunity: {
    first: number;
    second_three_team: number;
    second_two_team: number;
    last_or_second_two_team: number;
  };
  team_reward: {
    first: number;
    second_three_team: number;
    second_two_team: number;
    last: number;
  };
  tribal: {
    vote_matched: number;
    correct_target_vote?: number;
    zero_votes_received?: number;
    voted_out_base: number;
    voted_out_per_vote: number;
    voted_out_pocket_multiplier: number;
  };
  individual_immunity: number;
  confessionals?: {
    range_4_6: number;
    range_7_plus: number;
  };
  advantages: {
    clue_read: number;
    advantage_play: number;
    idol_play_per_vote?: number;
    idol_play?: number; // legacy flat value
    idol_failure: number;
  };
  other: { quit: number; medevac: number; add_player_penalty: number };
  captain_multiplier?: number;
}

export interface ScoreResult {
  total: number;
  breakdown: {
    survival: number;
    challenges: number;
    tribal: number;
    advantages: number;
    placement: number;
    penalties: number;
  };
  event_breakdown: Record<string, { count: number; points: number }>;
  captain_bonus: number;
  add_penalties: number;
}

const EVENT_TYPES = [
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
  "final_tribal",
  "win_season",
  "quit",
];

function initEventBreakdown(): Record<string, { count: number; points: number }> {
  return Object.fromEntries(
    EVENT_TYPES.map((et) => [et, { count: 0, points: 0 }])
  );
}

export interface Possessions {
  idols: number;
  advantages: number;
  clues: number;
}

/**
 * Compute possession counts per contestant through a given episode.
 * Walks episodes 1..throughEpisode: +1 on find, -1 on play/fail, reset on voted_out.
 */
export function computePossessionsThroughEpisode(
  episodeOutcomes: EpisodeOutcome[],
  throughEpisode: number
): Map<string, Possessions> {
  const map = new Map<string, Possessions>();
  const get = (cid: string): Possessions => {
    let p = map.get(cid);
    if (!p) {
      p = { idols: 0, advantages: 0, clues: 0 };
      map.set(cid, p);
    }
    return p;
  };

  for (const ep of episodeOutcomes) {
    const epNum = ep.episode_id ?? 0;
    if (epNum < 1 || epNum > throughEpisode) continue;

    if (ep.voted_out) {
      const p = get(ep.voted_out);
      p.idols = 0;
      p.advantages = 0;
      p.clues = 0;
    }

    if (ep.idol_finder) {
      const p = get(ep.idol_finder);
      p.idols += 1;
    }
    for (const cid of ep.idol_played ?? []) {
      const p = get(cid);
      p.idols = Math.max(0, p.idols - 1);
    }
    for (const cid of ep.idol_failed ?? []) {
      const p = get(cid);
      p.idols = Math.max(0, p.idols - 1);
    }

    if (ep.advantage_finder) {
      const p = get(ep.advantage_finder);
      p.advantages += 1;
    }
    for (const cid of ep.advantage_played ?? []) {
      const p = get(cid);
      p.advantages = Math.max(0, p.advantages - 1);
    }

    if (ep.clue_finder) {
      const p = get(ep.clue_finder);
      p.clues += 1;
    }
    for (const cid of ep.clue_readers ?? []) {
      const p = get(cid);
      p.clues = Math.max(0, p.clues - 1);
    }
  }

  return map;
}

/**
 * Get current tribe for a contestant through a given episode.
 * Uses contestant_tribes from the most recent episode with tribal structure.
 */
export function getCurrentTribe(
  contestantId: string,
  episodeOutcomes: EpisodeOutcome[],
  throughEpisode: number
): string | null {
  let result: string | null = null;
  for (const ep of episodeOutcomes) {
    const epNum = ep.episode_id ?? 0;
    if (epNum < 1 || epNum > throughEpisode) continue;
    const tribes = ep.contestant_tribes ?? {};
    for (const [tribe, ids] of Object.entries(tribes)) {
      if (ids.includes(contestantId)) {
        result = tribe;
        break;
      }
    }
  }
  return result;
}

/**
 * True if contestant went to tribal council (i.e. their tribe lost immunity).
 * Only the tribe that loses immunity attends tribal council.
 * Post-merge: everyone attends tribal (individual immunity).
 */
function contestantWentToTribal(cid: string, ep: EpisodeOutcome): boolean {
  if (ep.immunity_type === "individual") {
    return true; // Post-merge: everyone attends tribal
  }
  const teamResult = ep.team_immunity_results ?? {};
  const tribes = ep.contestant_tribes ?? {};
  const immunityTeams = ep.immunity_teams ?? 3;
  for (const [tribe, result] of Object.entries(teamResult)) {
    if (tribes[tribe]?.includes(cid)) {
      // 3-team: only last (result 3) goes to tribal; 2-team: only 2nd (result 2) goes
      const losingResult = immunityTeams === 2 ? 2 : immunityTeams;
      return result === losingResult;
    }
  }
  return false;
}

function calculateContestantEpisodePoints(
  cid: string,
  ep: EpisodeOutcome,
  scoringConfig: ScoringConfig
): number {
  let pts = 0;
  const phase = ep.phase ?? "pre_merge";
  const survival = scoringConfig.survival as {
    pre_merge_no_tribal?: number;
    pre_merge_tribal?: number;
    pre_merge?: number;
    post_merge: number;
  };
  const preMergeTribal = survival.pre_merge_tribal ?? survival.pre_merge ?? 1;
  const preMergeNoTribal = survival.pre_merge_no_tribal ?? 0;
  const postMerge = survival.post_merge;

  const active = ep.active_contestants ?? [];
  const votedOut = ep.voted_out;
  if (!active.includes(cid) && votedOut !== cid) {
    return 0;
  }

  // Survival: no tribal = 0; pre-merge/swap tribal survived = +1; post-merge = +3
  if (ep.tribal !== false && !ep.final_tribal) {
    const survived = ep.survived ?? [];
    if (survived.includes(cid)) {
      if (phase === "pre_merge" || phase === "swap") {
        pts += preMergeTribal;
      } else {
        pts += postMerge;
      }
    }
  } else if (ep.tribal === false && !ep.final_tribal) {
    const survived = ep.survived ?? [];
    if (survived.includes(cid)) pts += preMergeNoTribal;
  }

  // Team immunity
  if (ep.immunity_type === "team") {
    const teamResult = ep.team_immunity_results ?? {};
    const tribes = ep.contestant_tribes ?? {};
    for (const [tribe, result] of Object.entries(teamResult)) {
      if (tribes[tribe]?.includes(cid)) {
        if (result === 1) pts += scoringConfig.team_immunity.first;
        else if (result === 2 && (ep.immunity_teams ?? 3) === 3)
          pts += scoringConfig.team_immunity.second_three_team;
        else if (result === 2 && (ep.immunity_teams ?? 2) === 2)
          pts += scoringConfig.team_immunity.second_two_team ?? 0;
        else pts += scoringConfig.team_immunity.last_or_second_two_team;
        break;
      }
    }
  }

  // Team reward
  if (ep.reward_type === "team") {
    const rewardResult = ep.team_reward_results ?? {};
    const tribes = ep.contestant_tribes ?? {};
    for (const [tribe, result] of Object.entries(rewardResult)) {
      if (tribes[tribe]?.includes(cid)) {
        if (result === 1) pts += scoringConfig.team_reward.first;
        else if (result === 2 && (ep.reward_teams ?? 3) === 3)
          pts += scoringConfig.team_reward.second_three_team;
        else if (result === 2 && (ep.reward_teams ?? 2) === 2)
          pts += scoringConfig.team_reward.second_two_team ?? 0;
        break;
      }
    }
  }

  // Individual immunity
  if (
    ep.immunity_type === "individual" &&
    ep.individual_immunity_winner === cid
  ) {
    pts += scoringConfig.individual_immunity;
  }

  // Vote matched (only if contestant went to tribal - their tribe lost immunity)
  if (contestantWentToTribal(cid, ep) && (ep.vote_matched ?? []).includes(cid)) {
    pts += scoringConfig.tribal.vote_matched;
  }

  // Correct target vote (voted for the person who went home)
  const correctTarget = scoringConfig.tribal.correct_target_vote ?? 0;
  if (correctTarget !== 0 && votedOut && ep.vote_targets?.[cid] === votedOut) {
    pts += correctTarget;
  }

  // Zero votes received at tribal
  const zeroVotes = scoringConfig.tribal.zero_votes_received ?? 0;
  if (zeroVotes !== 0 && contestantWentToTribal(cid, ep) && (ep.votes_received?.[cid] ?? 0) === 0) {
    pts += zeroVotes;
  }

  // Voted out
  if (ep.voted_out === cid) {
    const base = scoringConfig.tribal.voted_out_base;
    const perVote = scoringConfig.tribal.voted_out_per_vote;
    const pocketMult = scoringConfig.tribal.voted_out_pocket_multiplier;
    const items = ep.voted_out_pocket_items ?? 0;
    const votes = ep.voted_out_votes ?? 0;
    pts += base * Math.pow(pocketMult, items) + perVote * votes;
  }

  // Confessionals
  const confessionals = scoringConfig.confessionals;
  if (confessionals) {
    const cc = ep.confessional_counts?.[cid] ?? 0;
    if (cc >= 4 && cc <= 6) pts += confessionals.range_4_6;
    if (cc >= 7) pts += confessionals.range_7_plus;
  }

  // Advantages
  if ((ep.clue_readers ?? []).includes(cid))
    pts += scoringConfig.advantages.clue_read;
  if ((ep.advantage_played ?? []).includes(cid))
    pts += scoringConfig.advantages.advantage_play;
  if ((ep.idol_played ?? []).includes(cid)) {
    const perVote = scoringConfig.advantages.idol_play_per_vote;
    if (perVote != null) {
      const nullified = ep.idol_votes_nullified ?? ep.voted_out_votes ?? 0;
      pts += perVote * nullified;
    } else {
      pts += scoringConfig.advantages.idol_play ?? 0;
    }
  }
  if ((ep.idol_failed ?? []).includes(cid))
    pts += scoringConfig.advantages.idol_failure;

  if (ep.quit === cid) pts += scoringConfig.other.quit;

  if (ep.final_tribal) {
    if ((ep.final_three ?? []).includes(cid)) {
      pts += scoringConfig.placement.final_tribal;
      if (ep.winner === cid) pts += scoringConfig.placement.win_season;
    }
  }

  return pts;
}

export interface EpisodePointSource {
  label: string;
  points: number;
}

/** Category labels used in point breakdown; used for admin category overrides dropdown and validation. */
export const POINT_BREAKDOWN_CATEGORIES = [
  "Survival",
  "Team immunity (1st)",
  "Team immunity (2nd)",
  "Team immunity (last)",
  "Team reward (1st)",
  "Individual immunity",
  "Vote matched",
  "Correct target vote",
  "Zero votes received",
  "Voted out",
  "Confessionals (4-6)",
  "Confessionals (7+)",
  "Clue read",
  "Advantage played",
  "Idol played",
  "Idol failed",
  "Quit",
  "Final tribal",
  "Win season",
  "Episode rank bonus",
] as const;
export type PointBreakdownCategory = (typeof POINT_BREAKDOWN_CATEGORIES)[number];

export interface ContestantEpisodeBreakdown {
  episode_id: number;
  total: number;
  sources: EpisodePointSource[];
  is_captain: boolean;
}

export interface ContestantPointsSummary {
  contestant_id: string;
  total_points: number;
  episodes: ContestantEpisodeBreakdown[];
}

/**
 * Get detailed breakdown of where a contestant earned points in an episode.
 */
export function calculateContestantEpisodeBreakdown(
  cid: string,
  ep: EpisodeOutcome,
  scoringConfig: ScoringConfig
): { total: number; sources: EpisodePointSource[] } {
  const sources: EpisodePointSource[] = [];
  const phase = ep.phase ?? "pre_merge";
  const survival = scoringConfig.survival as {
    pre_merge_tribal?: number;
    pre_merge?: number;
    post_merge: number;
  };
  const preMergeTribal = survival.pre_merge_tribal ?? survival.pre_merge ?? 1;
  const postMerge = survival.post_merge;

  const active = ep.active_contestants ?? [];
  const votedOut = ep.voted_out;
  if (!active.includes(cid) && votedOut !== cid) {
    return { total: 0, sources: [] };
  }

  // Survival
  if (ep.tribal !== false && !ep.final_tribal) {
    const survived = ep.survived ?? [];
    if (survived.includes(cid)) {
      const survivalPts = phase === "pre_merge" || phase === "swap" ? preMergeTribal : postMerge;
      if (survivalPts !== 0) sources.push({ label: "Survival", points: survivalPts });
    }
  }

  // Team immunity
  if (ep.immunity_type === "team") {
    const teamResult = ep.team_immunity_results ?? {};
    const tribes = ep.contestant_tribes ?? {};
    for (const [tribe, result] of Object.entries(teamResult)) {
      if (tribes[tribe]?.includes(cid)) {
        let pts: number;
        let label: string;
        if (result === 1) {
          pts = scoringConfig.team_immunity.first;
          label = "Team immunity (1st)";
        } else if (result === 2 && (ep.immunity_teams ?? 3) === 3) {
          pts = scoringConfig.team_immunity.second_three_team;
          label = "Team immunity (2nd)";
        } else if (result === 2 && (ep.immunity_teams ?? 2) === 2) {
          pts = scoringConfig.team_immunity.second_two_team ?? 0;
          label = "Team immunity (2nd)";
        } else {
          pts = scoringConfig.team_immunity.last_or_second_two_team;
          label = "Team immunity (last)";
        }
        if (pts !== 0) sources.push({ label, points: pts });
        break;
      }
    }
  }

  // Team reward
  if (ep.reward_type === "team") {
    const rewardResult = ep.team_reward_results ?? {};
    const tribes = ep.contestant_tribes ?? {};
    for (const [tribe, result] of Object.entries(rewardResult)) {
      if (tribes[tribe]?.includes(cid)) {
        if (result === 1) {
          const pts = scoringConfig.team_reward.first;
          if (pts !== 0) sources.push({ label: "Team reward (1st)", points: pts });
        }
        break;
      }
    }
  }

  // Individual immunity
  if (
    ep.immunity_type === "individual" &&
    ep.individual_immunity_winner === cid
  ) {
    const pts = scoringConfig.individual_immunity;
    sources.push({ label: "Individual immunity", points: pts });
  }

  // Vote matched (only if contestant went to tribal)
  if (contestantWentToTribal(cid, ep) && (ep.vote_matched ?? []).includes(cid)) {
    const pts = scoringConfig.tribal.vote_matched;
    sources.push({ label: "Vote matched", points: pts });
  }

  // Correct target vote
  const correctTarget = scoringConfig.tribal.correct_target_vote ?? 0;
  if (correctTarget !== 0 && votedOut && ep.vote_targets?.[cid] === votedOut) {
    sources.push({ label: "Correct target vote", points: correctTarget });
  }

  // Zero votes received
  const zeroVotes = scoringConfig.tribal.zero_votes_received ?? 0;
  if (zeroVotes !== 0 && contestantWentToTribal(cid, ep) && (ep.votes_received?.[cid] ?? 0) === 0) {
    sources.push({ label: "Zero votes received", points: zeroVotes });
  }

  // Voted out
  if (ep.voted_out === cid) {
    const base = scoringConfig.tribal.voted_out_base;
    const perVote = scoringConfig.tribal.voted_out_per_vote;
    const pocketMult = scoringConfig.tribal.voted_out_pocket_multiplier;
    const items = ep.voted_out_pocket_items ?? 0;
    const votes = ep.voted_out_votes ?? 0;
    const penalty =
      base * Math.pow(pocketMult, items) + perVote * votes;
    sources.push({ label: "Voted out", points: penalty });
  }

  // Confessionals
  const confessionals = scoringConfig.confessionals;
  if (confessionals) {
    const cc = ep.confessional_counts?.[cid] ?? 0;
    if (cc >= 4 && cc <= 6) sources.push({ label: "Confessionals (4-6)", points: confessionals.range_4_6 });
    if (cc >= 7) sources.push({ label: "Confessionals (7+)", points: confessionals.range_7_plus });
  }

  // Advantages
  if ((ep.clue_readers ?? []).includes(cid))
    sources.push({ label: "Clue read", points: scoringConfig.advantages.clue_read });
  if ((ep.advantage_played ?? []).includes(cid))
    sources.push({ label: "Advantage played", points: scoringConfig.advantages.advantage_play });
  if ((ep.idol_played ?? []).includes(cid)) {
    const perVote = scoringConfig.advantages.idol_play_per_vote;
    if (perVote != null) {
      const nullified = ep.idol_votes_nullified ?? ep.voted_out_votes ?? 0;
      const pts = perVote * nullified;
      if (pts !== 0) sources.push({ label: "Idol played", points: pts });
    } else {
      const pts = scoringConfig.advantages.idol_play ?? 0;
      if (pts !== 0) sources.push({ label: "Idol played", points: pts });
    }
  }
  if ((ep.idol_failed ?? []).includes(cid))
    sources.push({ label: "Idol failed", points: scoringConfig.advantages.idol_failure });

  if (ep.quit === cid)
    sources.push({ label: "Quit", points: scoringConfig.other.quit });

  if (ep.final_tribal) {
    if ((ep.final_three ?? []).includes(cid)) {
      sources.push({ label: "Final tribal", points: scoringConfig.placement.final_tribal });
      if (ep.winner === cid)
        sources.push({ label: "Win season", points: scoringConfig.placement.win_season });
    }
  }

  const total = sources.reduce((sum, s) => sum + s.points, 0);
  return { total, sources };
}

/**
 * Get roster (contestant IDs) for episode N.
 * Player is on roster if: added_at_episode <= N and (removed_at_episode is null or removed_at_episode >= N).
 * removed_at_episode = N means "last episode on roster was N" (sold in transfer window after episode N).
 * Points are permanent: sold players keep points from when they were on the team.
 */
function rosterForEpisode(
  entries: TribeEntry[],
  episodeNum: number
): string[] {
  return entries
    .filter(
      (e) =>
        e.added_at_episode <= episodeNum &&
        (e.removed_at_episode == null || e.removed_at_episode >= episodeNum)
    )
    .map((e) => e.contestant_id);
}

/**
 * Calculate total points for a roster across episode outcomes.
 * Supports captain (2x per episode), add penalty, and optional BPS episode rank bonus.
 */
export function calculateRosterPoints(
  entries: TribeEntry[],
  episodeOutcomes: EpisodeOutcome[],
  scoringConfig: ScoringConfig,
  captainPerEpisode?: (string | null)[],
  bpsConfig?: BPSConfig | null
): ScoreResult {
  const breakdown = {
    survival: 0,
    challenges: 0,
    tribal: 0,
    advantages: 0,
    placement: 0,
    penalties: 0,
  };
  const eventBreakdown = initEventBreakdown();
  const captainMultiplier = scoringConfig.captain_multiplier ?? 2;
  let captainBonusTotal = 0;

  // Add penalty per roster member added via transfer (added_at_episode > 1)
  const addPenalty = scoringConfig.other.add_player_penalty ?? -10;
  const addCount = entries.filter((e) => e.added_at_episode > 1).length;
  const addPenaltiesTotal = addCount * addPenalty;
  breakdown.penalties += addPenaltiesTotal;

  const bpsBonuses = bpsConfig ? getEpisodeRankBonuses(episodeOutcomes, bpsConfig) : null;
  const survival = scoringConfig.survival as {
    pre_merge_tribal?: number;
    pre_merge?: number;
    post_merge: number;
  };
  const preMergeTribal = survival.pre_merge_tribal ?? survival.pre_merge ?? 1;
  const postMerge = survival.post_merge;

  for (let epIdx = 0; epIdx < episodeOutcomes.length; epIdx++) {
    const ep = episodeOutcomes[epIdx];
    const episodeNum = epIdx + 1;
    const epId = ep.episode_id ?? episodeNum;
    const phase = ep.phase ?? "pre_merge";
    const survivalPts = phase === "pre_merge" || phase === "swap" ? preMergeTribal : postMerge;
    const survivalKey = phase === "pre_merge" ? "survival_pre_merge" : "survival_swap";

    const roster = rosterForEpisode(entries, epId);
    const episodePtsByCid: Record<string, number> = {};

    for (const cid of roster) {
      const isVotedOutThisEp = ep.voted_out === cid;
      const active = ep.active_contestants ?? [];
      if (!isVotedOutThisEp && !active.includes(cid)) continue;

      episodePtsByCid[cid] = calculateContestantEpisodePoints(
        cid,
        ep,
        scoringConfig
      );

      // BPS episode rank bonus
      if (bpsBonuses) {
        const bonusMap = bpsBonuses.get(epId);
        const bonus = bonusMap?.get(cid) ?? 0;
        if (bonus > 0) {
          episodePtsByCid[cid] += bonus;
          breakdown.tribal += bonus;
          eventBreakdown.episode_rank_bonus.count += 1;
          eventBreakdown.episode_rank_bonus.points += bonus;
        }
      }

      // Survival
      if (ep.tribal !== false && !ep.final_tribal) {
        const survived = ep.survived ?? [];
        if (survived.includes(cid)) {
          breakdown.survival += survivalPts;
          eventBreakdown[survivalKey].count += 1;
          eventBreakdown[survivalKey].points += survivalPts;
        }
      }

      // Team immunity
      if (ep.immunity_type === "team") {
        const teamResult = ep.team_immunity_results ?? {};
        const tribes = ep.contestant_tribes ?? {};
        for (const [tribe, result] of Object.entries(teamResult)) {
          if (tribes[tribe]?.includes(cid)) {
            let pts: number;
            if (result === 1) {
              pts = scoringConfig.team_immunity.first;
              eventBreakdown.team_immunity_first.count += 1;
              eventBreakdown.team_immunity_first.points += pts;
            } else if (result === 2 && (ep.immunity_teams ?? 3) === 3) {
              pts = scoringConfig.team_immunity.second_three_team;
              eventBreakdown.team_immunity_second_three.count += 1;
              eventBreakdown.team_immunity_second_three.points += pts;
            } else if (result === 2 && (ep.immunity_teams ?? 2) === 2) {
              pts = scoringConfig.team_immunity.second_two_team ?? 0;
              eventBreakdown.team_immunity_second_two.count += 1;
              eventBreakdown.team_immunity_second_two.points += pts;
            } else {
              pts = scoringConfig.team_immunity.last_or_second_two_team;
              eventBreakdown.team_immunity_last.count += 1;
              eventBreakdown.team_immunity_last.points += pts;
            }
            breakdown.challenges += pts;
            break;
          }
        }
      }

      // Team reward
      if (ep.reward_type === "team") {
        const rewardResult = ep.team_reward_results ?? {};
        const tribes = ep.contestant_tribes ?? {};
        for (const [tribe, result] of Object.entries(rewardResult)) {
          if (tribes[tribe]?.includes(cid)) {
            if (result === 1) {
              const pts = scoringConfig.team_reward.first;
              breakdown.challenges += pts;
              eventBreakdown.team_reward_first.count += 1;
              eventBreakdown.team_reward_first.points += pts;
            } else if (result === 2 && (ep.reward_teams ?? 3) === 3) {
              const pts = scoringConfig.team_reward.second_three_team;
              breakdown.challenges += pts;
              eventBreakdown.team_reward_second_three.count += 1;
              eventBreakdown.team_reward_second_three.points += pts;
            } else if (result === 2 && (ep.reward_teams ?? 2) === 2) {
              const pts = scoringConfig.team_reward.second_two_team ?? 0;
              breakdown.challenges += pts;
              eventBreakdown.team_reward_second_two.count += 1;
              eventBreakdown.team_reward_second_two.points += pts;
            }
            break;
          }
        }
      }

      // Individual immunity
      if (
        ep.immunity_type === "individual" &&
        ep.individual_immunity_winner === cid
      ) {
        const pts = scoringConfig.individual_immunity;
        breakdown.challenges += pts;
        eventBreakdown.individual_immunity.count += 1;
        eventBreakdown.individual_immunity.points += pts;
      }

      // Vote matched (only if contestant went to tribal)
      if (contestantWentToTribal(cid, ep) && (ep.vote_matched ?? []).includes(cid)) {
        const pts = scoringConfig.tribal.vote_matched;
        breakdown.tribal += pts;
        eventBreakdown.vote_matched.count += 1;
        eventBreakdown.vote_matched.points += pts;
      }
      const correctTarget = scoringConfig.tribal.correct_target_vote ?? 0;
      if (correctTarget !== 0 && ep.voted_out && ep.vote_targets?.[cid] === ep.voted_out) {
        breakdown.tribal += correctTarget;
        eventBreakdown.correct_target_vote.count += 1;
        eventBreakdown.correct_target_vote.points += correctTarget;
      }
      const zeroVotes = scoringConfig.tribal.zero_votes_received ?? 0;
      if (zeroVotes !== 0 && contestantWentToTribal(cid, ep) && (ep.votes_received?.[cid] ?? 0) === 0) {
        breakdown.tribal += zeroVotes;
        eventBreakdown.zero_votes_received.count += 1;
        eventBreakdown.zero_votes_received.points += zeroVotes;
      }

      // Voted out
      if (ep.voted_out === cid) {
        const base = scoringConfig.tribal.voted_out_base;
        const perVote = scoringConfig.tribal.voted_out_per_vote;
        const pocketMult = scoringConfig.tribal.voted_out_pocket_multiplier;
        const items = ep.voted_out_pocket_items ?? 0;
        const votes = ep.voted_out_votes ?? 0;
        const penalty =
          base * Math.pow(pocketMult, items) + perVote * votes;
        breakdown.penalties += penalty;
        eventBreakdown.voted_out.count += 1;
        eventBreakdown.voted_out.points += penalty;
      }

      // Advantages
      if ((ep.clue_readers ?? []).includes(cid)) {
        const pts = scoringConfig.advantages.clue_read;
        breakdown.advantages += pts;
        eventBreakdown.clue_read.count += 1;
        eventBreakdown.clue_read.points += pts;
      }
      if ((ep.advantage_played ?? []).includes(cid)) {
        const pts = scoringConfig.advantages.advantage_play;
        breakdown.advantages += pts;
        eventBreakdown.advantage_play.count += 1;
        eventBreakdown.advantage_play.points += pts;
      }
      if ((ep.idol_played ?? []).includes(cid)) {
        const perVote = scoringConfig.advantages.idol_play_per_vote;
        const pts = perVote != null
          ? perVote * (ep.idol_votes_nullified ?? ep.voted_out_votes ?? 0)
          : (scoringConfig.advantages.idol_play ?? 0);
        breakdown.advantages += pts;
        eventBreakdown.idol_play.count += 1;
        eventBreakdown.idol_play.points += pts;
      }
      if ((ep.idol_failed ?? []).includes(cid)) {
        const pts = scoringConfig.advantages.idol_failure;
        breakdown.penalties += pts;
        eventBreakdown.idol_failure.count += 1;
        eventBreakdown.idol_failure.points += pts;
      }
      const confessionals = scoringConfig.confessionals;
      if (confessionals) {
        const cc = ep.confessional_counts?.[cid] ?? 0;
        if (cc >= 4 && cc <= 6) {
          breakdown.advantages += confessionals.range_4_6;
          eventBreakdown.confessionals.count += 1;
          eventBreakdown.confessionals.points += confessionals.range_4_6;
        }
        if (cc >= 7) {
          breakdown.advantages += confessionals.range_7_plus;
          eventBreakdown.confessionals.count += 1;
          eventBreakdown.confessionals.points += confessionals.range_7_plus;
        }
      }

      if (ep.quit === cid) {
        const pts = scoringConfig.other.quit;
        breakdown.penalties += pts;
        eventBreakdown.quit.count += 1;
        eventBreakdown.quit.points += pts;
      }
    }

    // Captain bonus
    if (captainPerEpisode && epIdx < captainPerEpisode.length) {
      const captain = captainPerEpisode[epIdx];
      if (captain && roster.includes(captain)) {
        captainBonusTotal +=
          (captainMultiplier - 1) * (episodePtsByCid[captain] ?? 0);
      }
    }

    // Placement (final tribal)
    if (ep.final_tribal) {
      const finalThree = ep.final_three ?? [];
      for (const cid of roster) {
        if (finalThree.includes(cid)) {
          const ptsFt = scoringConfig.placement.final_tribal;
          breakdown.placement += ptsFt;
          eventBreakdown.final_tribal.count += 1;
          eventBreakdown.final_tribal.points += ptsFt;
          if (cid === ep.winner) {
            const ptsWin = scoringConfig.placement.win_season;
            breakdown.placement += ptsWin;
            eventBreakdown.win_season.count += 1;
            eventBreakdown.win_season.points += ptsWin;
          }
        }
      }
    }
  }

  const total =
    Object.values(breakdown).reduce((a, b) => a + b, 0) + captainBonusTotal;

  return {
    total,
    breakdown,
    event_breakdown: eventBreakdown,
    captain_bonus: captainBonusTotal,
    add_penalties: addPenaltiesTotal,
  };
}

/**
 * Calculate roster points with per-contestant per-episode breakdown.
 */
export function calculateRosterPointsWithBreakdown(
  entries: TribeEntry[],
  episodeOutcomes: EpisodeOutcome[],
  scoringConfig: ScoringConfig,
  captainPerEpisode?: (string | null)[],
  bpsConfig?: BPSConfig | null
): ScoreResult & { contestant_breakdowns: ContestantPointsSummary[] } {
  const base = calculateRosterPoints(
    entries,
    episodeOutcomes,
    scoringConfig,
    captainPerEpisode,
    bpsConfig
  );

  const captainMultiplier = scoringConfig.captain_multiplier ?? 2;
  const contestantBreakdowns: ContestantPointsSummary[] = [];
  const bpsBonuses = bpsConfig ? getEpisodeRankBonuses(episodeOutcomes, bpsConfig) : null;

  // Include all entries (current + sold) for full point history
  const allEntries = entries;
  for (const entry of allEntries) {
    const cid = entry.contestant_id;
    const episodes: ContestantEpisodeBreakdown[] = [];
    let totalPoints = 0;

    for (let epIdx = 0; epIdx < episodeOutcomes.length; epIdx++) {
      const ep = episodeOutcomes[epIdx];
      const episodeNum = epIdx + 1;
      const epId = ep.episode_id ?? episodeNum;
      const roster = rosterForEpisode(entries, epId);
      if (!roster.includes(cid)) continue;

      const isVotedOut = ep.voted_out === cid;
      const active = ep.active_contestants ?? [];
      if (!isVotedOut && !active.includes(cid)) continue;

      const { total, sources } = calculateContestantEpisodeBreakdown(
        cid,
        ep,
        scoringConfig
      );
      const bpsBonus = bpsBonuses?.get(epId)?.get(cid) ?? 0;
      const episodeTotalWithBps = total + bpsBonus;
      const sourcesWithBps = bpsBonus > 0
        ? [...sources, { label: "Episode rank bonus", points: bpsBonus }]
        : sources;
      const isCaptain = captainPerEpisode?.[epIdx] === cid;
      const captainBonus = isCaptain ? (captainMultiplier - 1) * episodeTotalWithBps : 0;
      const displayTotal = episodeTotalWithBps + captainBonus;

      episodes.push({
        episode_id: epId,
        total: displayTotal,
        sources: sourcesWithBps,
        is_captain: isCaptain,
      });
      totalPoints += displayTotal;
    }

    // Add penalty NOT in contestant breakdown - it's team-level only
    const addPenalty = scoringConfig.other.add_player_penalty ?? -10;
    if (entry.added_at_episode > 1) {
      totalPoints += addPenalty;
    }

    contestantBreakdowns.push({
      contestant_id: cid,
      total_points: totalPoints,
      episodes,
    });
  }

  return {
    ...base,
    contestant_breakdowns: contestantBreakdowns,
  };
}
