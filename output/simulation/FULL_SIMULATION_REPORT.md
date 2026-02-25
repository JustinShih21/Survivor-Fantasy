# Full-Stack Simulation Report

## Overview

**Total runs:** 4,000 (scenarios × rosters × play styles)
**Scenarios:** 50
**Replacement penalty:** -10 points per add
**Captain multiplier:** 2.0x (required every episode)

---

## Executive Summary for Tuning

| Metric | Value | Tuning implication |
|--------|-------|-------------------|
| Survival % of total | 47.9% | Core floor; adjust pre/post/swap if too flat |
| Challenges % of total | 26.5% | Immunity/reward weights; individual immunity rare |
| Vote matched % | 22.1% | High impact; consider if over-rewarding |
| Voted out penalty % | -20.8% | Major negative; pocket multiplier matters |
| Captain bonus % | 13.6% | 2x adds ~35 pts/run avg |
| Replacement lift | +110.7 pts vs fixed | Replace worth it despite -10 add penalty |
| Best combo | mid_tier_replace | Target for balance; others should close gap |
| Worst combo | stars_and_scrubs_fixed | May need pricing/strategy tweaks |

---

## How the Simulation Works

### Rules of Each Simulated Game

1. **Initial roster:** 7 players, min 1 per tribe, under $1M budget. Built using strategy (value, max_expected, mid_tier, etc.).
2. **No replacement (fixed):** When a roster member is voted off, they are not replaced. The roster shrinks; eliminated players stop earning points but can still incur voted-out penalty.
3. **Replacement (replace):** When a roster member is voted off, if viable replacements exist (affordable with freed budget, within value tolerance), the best-value option is added. A **-10 point penalty** is applied per add (sell has no penalty).
4. **Captain (required):** Every episode, captain = highest expected pts among active roster. Captain earns **2x points** for that episode only.
5. **Price evolution:** Prices update after each tribal (demand-based: strong performers rise, weak fall). No universal inflation. All rosters in a scenario see the same price evolution.
6. **Scoring:** Survival, challenges, tribal, advantages, placement. Same point values as production config.

### Play Styles Tested

| Style | Replacement | Captain |
|-------|-------------|---------|
| fixed | No | Yes (required) |
| replace | Yes (when viable) | Yes (required) |

---

## Point Breakdown (Aggregate)

### Survival: 497,285 points (47.9%)

- **survival_pre_merge:** 134,002 pts (134,002 events, 12.9%)
- **survival_swap:** 79,684 pts (79,684 events, 7.7%)
- **survival_post_merge:** 283,599 pts (94,533 events, 27.3%)

### Challenges: 274,571 points (26.5%)

- **team_immunity_first:** 84,852 pts (84,852 events, 8.2%)
- **team_immunity_second_three:** 0 pts (47,099 events, 0.0%)
- **team_immunity_second_two:** 0 pts (42,084 events, 0.0%)
- **team_immunity_last:** 0 pts (45,564 events, 0.0%)
- **team_reward_first:** 88,949 pts (88,949 events, 8.6%)
- **team_reward_second_three:** 0 pts (45,720 events, 0.0%)
- **team_reward_second_two:** 0 pts (40,053 events, 0.0%)
- **individual_immunity:** 100,770 pts (16,795 events, 9.7%)

### Tribal: 13,425 points (1.3%)

- **vote_matched:** 229,699 pts (229,699 events, 22.1%)
- **voted_out:** -216,274 pts (12,291 events, -20.8%)

### Advantages: 167,318 points (16.1%)

- **clue_read:** 13,600 pts (6,800 events, 1.3%)
- **advantage_play:** 3,315 pts (663 events, 0.3%)
- **idol_play:** 10,824 pts (1,353 events, 1.0%)
- **idol_failure:** -1,946 pts (973 events, -0.2%)
- **strategic_player:** 141,525 pts (28,305 events, 13.6%)

### Placement: 72,858 points (7.0%)

- **final_tribal:** 46,758 pts (7,793 events, 4.5%)
- **win_season:** 26,100 pts (2,610 events, 2.5%)

### Other: 0 points (0.0%)


### Captain Bonus: 140,862 points
### Replacement Penalty: -128,550 points

---

## Play Style Comparison

| Play Style | Avg Score | Runs |
|------------|-----------|------|
| fixed | 204.1 | 2,000 |
| replace | 314.8 | 2,000 |

---

## Strategy × Play Style (Emerging Strategies)

| Strategy | Play Style | Avg | Min | Max |
|----------|------------|-----|-----|-----|
| balanced | fixed | 197.9 | 36.0 | 374.0 |
| balanced | replace | 293.6 | -40.0 | 682.0 |
| five_premium | fixed | 197.9 | 36.0 | 374.0 |
| five_premium | replace | 293.6 | -40.0 | 682.0 |
| max_expected | fixed | 197.9 | 36.0 | 374.0 |
| max_expected | replace | 293.6 | -40.0 | 682.0 |
| mid_tier | fixed | 209.9 | -11.0 | 425.0 |
| mid_tier | replace | 341.8 | -25.0 | 731.0 |
| random | fixed | 213.8 | 2.0 | 512.0 |
| random | replace | 338.7 | -33.0 | 756.0 |
| six_premium | fixed | 197.9 | 36.0 | 374.0 |
| six_premium | replace | 293.6 | -40.0 | 682.0 |
| stars_and_scrubs | fixed | 197.7 | -4.0 | 376.0 |
| stars_and_scrubs | replace | 327.5 | 0.0 | 788.0 |
| value | fixed | 219.8 | -29.0 | 381.0 |
| value | replace | 335.7 | -25.0 | 741.0 |

---

## Captaincy Impact

Total captain bonus across all runs: **140,862** points (~35 per run).
Captain is required every episode; chosen as highest expected pts among active roster.
**Tuning:** If captain bonus dominates, lower multiplier (e.g. 1.5x). If too weak, raise it.

---

## Tuning Recommendations

### Point System
- **Survival vs challenges:** If survival dominates (>45%), consider raising challenge pts (immunity, reward).
- **Vote matched:** Often highest positive event. If you want less predictability, lower it.
- **Voted out:** Pocket multiplier (2^items) can create huge swings. Consider capping or flattening.
- **Strategic player:** High variance event. Adjust if too swingy.

### Pricing
- **price_min/max:** Wider range = more roster diversity but harder to balance.
- **target_valid_pct:** Lower = fewer viable combos = more budget pressure.
- **Add player penalty:** -10 per add (sell has no penalty). If replace always dominates, raise penalty.

### Strategy Balance
- Best: **mid_tier_replace** (avg 341.8). Worst: **stars_and_scrubs_fixed** (avg 197.7).
- Gap: 144.1 pts. Narrow by: flattening prices, adjusting point weights, or roster constraints.

---

## Roster Change Viability

**Replacements made:** 12,855
**Total replacement penalty:** -128,550 points
**Penalty per replacement:** -10

Replacements occur when a roster member is voted off and viable options exist
(affordable with freed budget, within value tolerance). Constant roster changes
are viable when replacements are affordable; the -10 point add penalty creates
tradeoff between keeping a weaker roster vs. paying to upgrade.

---

## Price Changes: How Big of a Deal?

Prices update after each tribal via demand-based movement:
- **Performance delta:** Strong performers (immunity, vote matched) rise; weak performers fall
- **No universal inflation:** Prices differentiate by performance only; no lockstep rise

**Impact on replacements:** When a roster member is voted off, budget freed = their price.
Higher-priced vote-offs (e.g. $200k) free more budget for replacements than cheap vote-offs ($100k).
Early cheap vote-offs often yield 0 affordable replacements; late expensive vote-offs
free budget but fewer players remain. Price dynamics create strategic tension:
owning expensive players risks early vote-off with limited replacement options.

**Impact on strategy:** Replace outperforms fixed by **+110.7 pts** on average,
despite the -10 penalty per add. If this gap is too large, consider:
raising replacement penalty, tightening value tolerance, or reducing merge budget.

---

## Highest Potential Captaincies

Contestants with highest expected points offer the most captain upside:

- **c21:** 32.8 expected pts (2x when captained)
- **c23:** 31.6 expected pts (2x when captained)
- **c05:** 30.3 expected pts (2x when captained)
- **c13:** 29.3 expected pts (2x when captained)
- **c07:** 28.6 expected pts (2x when captained)
- **c15:** 27.7 expected pts (2x when captained)
- **c09:** 27.6 expected pts (2x when captained)
- **c11:** 27.3 expected pts (2x when captained)
- **c10:** 26.6 expected pts (2x when captained)
- **c01:** 26.1 expected pts (2x when captained)
