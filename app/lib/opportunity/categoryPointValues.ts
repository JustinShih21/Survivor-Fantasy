import type { ScoringConfig } from "@/lib/scoring";

function phaseAwareSurvivalPoints(
  scoringConfig: ScoringConfig,
  phase?: string | null
): number {
  const survival = scoringConfig.survival as {
    pre_merge_tribal?: number;
    pre_merge?: number;
    post_merge: number;
  };
  const preMerge = survival.pre_merge_tribal ?? survival.pre_merge ?? 1;
  const postMerge = survival.post_merge;
  const normalized = (phase ?? "").toLowerCase();
  if (normalized === "post_merge") return postMerge;
  return preMerge;
}

export function getCategoryPointValue(
  category: string,
  scoringConfig: ScoringConfig,
  options?: { phase?: string | null }
): number | null {
  switch (category) {
    case "Survival":
      return phaseAwareSurvivalPoints(scoringConfig, options?.phase);
    case "Team immunity (1st)":
      return scoringConfig.team_immunity.first;
    case "Team immunity (2nd)":
      return (
        scoringConfig.team_immunity.second_three_team ??
        scoringConfig.team_immunity.second_two_team ??
        0
      );
    case "Team immunity (last)":
      return scoringConfig.team_immunity.last_or_second_two_team;
    case "Individual immunity":
      return scoringConfig.individual_immunity;
    case "Vote matched":
      return scoringConfig.tribal.vote_matched;
    case "Correct target vote":
      return scoringConfig.tribal.correct_target_vote ?? 0;
    case "Zero votes received":
      return scoringConfig.tribal.zero_votes_received ?? 0;
    case "Confessionals (4-6)":
      return scoringConfig.confessionals?.range_4_6 ?? 0;
    case "Confessionals (7+)":
      return scoringConfig.confessionals?.range_7_plus ?? 0;
    case "Advantage played":
      return scoringConfig.advantages.advantage_play;
    case "Idol played": {
      if (typeof scoringConfig.advantages.idol_play === "number") {
        return scoringConfig.advantages.idol_play;
      }
      return scoringConfig.advantages.idol_play_per_vote ?? 0;
    }
    case "Clue read":
      return scoringConfig.advantages.clue_read;
    default:
      return null;
  }
}
