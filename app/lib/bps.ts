/**
 * Episode Impact Bonus System (BPS) - Social-dominant ranking.
 * Calculates BPS per contestant per episode; only top-3 episode rank bonuses
 * are added to the main scoring system.
 */

import type { EpisodeOutcome } from "./scoring";

export interface BPSConfig {
  social: {
    inclusion_in_plan: number;
    safety_statement: number;
    vote_info_correct: number;
    advantage_info_correct: number;
    initiates_strategic: number;
    kept_commitment: number;
    swing_label: number;
    named_target_survives: number;
  };
  advantage: {
    clue_found: number;
    advantage_or_idol_found: number;
    advantage_or_idol_played: number;
    idol_nullifies_votes: number;
    holds_idol_through_tribal: number;
    failed_idol_play: number;
  };
  challenge: {
    wins_team_immunity: number;
    wins_individual_immunity: number;
    key_contributor: number;
    costs_challenge: number;
  };
  visibility: {
    confessionals_4_6: number;
    confessionals_7_plus: number;
    episode_narrator: number;
  };
  episode_rank_bonus: {
    first: number;
    second: number;
    third: number;
  };
}

function contestantWentToTribal(cid: string, ep: EpisodeOutcome): boolean {
  if (ep.immunity_type === "individual") return true;
  const teamResult = ep.team_immunity_results ?? {};
  const tribes = ep.contestant_tribes ?? {};
  const immunityTeams = ep.immunity_teams ?? 3;
  for (const [tribe, result] of Object.entries(teamResult)) {
    if (tribes[tribe]?.includes(cid)) {
      const losingResult = immunityTeams === 2 ? 2 : immunityTeams;
      return result === losingResult;
    }
  }
  return false;
}

/**
 * Calculate BPS points for a single contestant in an episode.
 */
export function calculateBPSPerContestant(
  cid: string,
  ep: EpisodeOutcome,
  config: BPSConfig
): number {
  let pts = 0;
  const active = ep.active_contestants ?? [];
  const votedOut = ep.voted_out;
  if (!active.includes(cid) && votedOut !== cid) return 0;

  // A) Social & Strategic
  if ((ep.inclusion_in_plan ?? []).includes(cid)) pts += config.social.inclusion_in_plan;
  if ((ep.safety_statement ?? []).includes(cid)) pts += config.social.safety_statement;
  if ((ep.vote_info_correct ?? []).includes(cid)) pts += config.social.vote_info_correct;
  if ((ep.advantage_info_correct ?? []).includes(cid)) pts += config.social.advantage_info_correct;
  if ((ep.initiates_strategic ?? []).includes(cid)) pts += config.social.initiates_strategic;
  if ((ep.kept_commitment ?? []).includes(cid)) pts += config.social.kept_commitment;
  if ((ep.swing_label ?? []).includes(cid)) pts += config.social.swing_label;
  if ((ep.named_target_survives ?? []).includes(cid)) pts += config.social.named_target_survives;

  // B) Advantage & Risk
  if (ep.clue_finder === cid) pts += config.advantage.clue_found;
  if (ep.idol_finder === cid || ep.advantage_finder === cid) pts += config.advantage.advantage_or_idol_found;
  if ((ep.idol_played ?? []).includes(cid) || (ep.advantage_played ?? []).includes(cid)) {
    pts += config.advantage.advantage_or_idol_played;
    const nullified = ep.idol_votes_nullified ?? 0;
    if ((ep.idol_played ?? []).includes(cid) && nullified > 0) {
      pts += config.advantage.idol_nullifies_votes * nullified;
    }
  }
  // Holds idol through tribal (had idol, didn't play, survived) - requires possession tracking
  // Schema placeholder: not derivable from current outcomes; skip for now
  if ((ep.idol_failed ?? []).includes(cid)) pts += config.advantage.failed_idol_play;

  // C) Challenge
  if (ep.immunity_type === "team") {
    const teamResult = ep.team_immunity_results ?? {};
    const tribes = ep.contestant_tribes ?? {};
    for (const [tribe, result] of Object.entries(teamResult)) {
      if (tribes[tribe]?.includes(cid) && result === 1) {
        pts += config.challenge.wins_team_immunity;
        break;
      }
    }
  }
  if (ep.immunity_type === "individual" && ep.individual_immunity_winner === cid) {
    pts += config.challenge.wins_individual_immunity;
  }
  if ((ep.key_contributor ?? []).includes(cid)) pts += config.challenge.key_contributor;
  if ((ep.costs_challenge ?? []).includes(cid)) pts += config.challenge.costs_challenge;

  // D) Visibility
  const cc = ep.confessional_counts?.[cid] ?? 0;
  if (cc >= 4 && cc <= 6) pts += config.visibility.confessionals_4_6;
  if (cc >= 7) pts += config.visibility.confessionals_7_plus;
  if (ep.episode_narrator != null && ep.episode_narrator === cid) pts += config.visibility.episode_narrator;

  return pts;
}

/**
 * Rank contestants by BPS for an episode, apply tie rules, return bonus map.
 * Tie handling: ties receive the higher bonus; next rank is skipped.
 */
export function getEpisodeRankBonuses(
  episodeOutcomes: EpisodeOutcome[],
  config: BPSConfig
): Map<number, Map<string, number>> {
  const result = new Map<number, Map<string, number>>();
  const bonusValues = [config.episode_rank_bonus.first, config.episode_rank_bonus.second, config.episode_rank_bonus.third];

  for (const ep of episodeOutcomes) {
    const epId = ep.episode_id ?? 0;
    if (ep.final_tribal) continue; // No BPS for final tribal

    const active = ep.active_contestants ?? [];
    const votedOut = ep.voted_out;
    const participants = votedOut ? [...active, votedOut] : [...active];
    if (participants.length === 0) continue;

    const scores: { cid: string; bps: number }[] = participants.map((cid) => ({
      cid,
      bps: calculateBPSPerContestant(cid, ep, config),
    }));

    scores.sort((a, b) => b.bps - a.bps);

    const bonusMap = new Map<string, number>();
    let rankIndex = 0;
    let bonusIndex = 0;

    while (rankIndex < scores.length && bonusIndex < bonusValues.length) {
      const currentBps = scores[rankIndex].bps;
      const tied: string[] = [];
      let i = rankIndex;
      while (i < scores.length && scores[i].bps === currentBps) {
        tied.push(scores[i].cid);
        i++;
      }
      const bonus = bonusValues[bonusIndex];
      for (const cid of tied) {
        bonusMap.set(cid, bonus);
      }
      rankIndex = i;
      bonusIndex += 1;
    }

    result.set(epId, bonusMap);
  }

  return result;
}
