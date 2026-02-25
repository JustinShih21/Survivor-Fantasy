# Phase 1: Pricing Simulation Report

## Summary

- **Budget:** $1,000,000
- **Roster rules:** Exactly 7 players required, min 1 per tribe
- **Price estimation runs:** 2000
- **Scenario runs (scoring):** 300
- **Unique roster compositions tested:** 29

### Total Valid Team Options (Pricing System)

- **Total valid under budget:** 204,226
- **Total possible (tribe-valid):** 311,808
- **Excluded by pricing:** 34.5%
- 7-player rosters: 204,226

---


## Price Distribution

| Metric | Value |
|--------|-------|
| Min price | $102,500 |
| Max price | $207,500 |
| Sum (all 24) | $3,335,000 |
| Top 5 by expected (cost) | $935,000 |
| Top 6 by expected (cost) | $1,090,000 |
| Top 7 by expected (cost) | $1,242,500 |

**Viability:** Top 7 by expected points > budget (cannot own all 7 most expensive). ~25% of team combos excluded by pricing.

---

## Players by Price (Breakdown by Price Tier)

| Price | Contestants |
|-------|-------------|
| $207,500 | c05, c21 |
| $192,500 | c13 |
| $170,000 | c23 |
| $157,500 | c11 |
| $155,000 | c07 |
| $152,500 | c17 |
| $150,000 | c01, c15, c19 |
| $147,500 | c09 |
| $145,000 | c03 |
| $127,500 | c24, c08 |
| $125,000 | c10, c18 |
| $115,000 | c02, c16 |
| $102,500 | c20, c04, c12, c06, c22, c14 |

---

## Point Breakdown (Aggregate Across All Runs)

| Category | Total Points | % of Total |
|----------|--------------|------------|
| survival | 9,318,265 | 42.1% |
| challenges | 8,079,601 | 36.5% |
| tribal | 6,386,848 | 28.9% |
| advantages | 1,405,081 | 6.3% |
| placement | 390,148 | 1.8% |
| penalties | -3,443,837 | -15.6% |

---

## Event Breakdown (Points by Event Type)

| Event Type | Total Points | % of Total | Count |
|------------|--------------|------------|-------|
| Vote matched | 6,386,848 | 28.9% | 3,193,424 |
| Survival (pre-merge) | 4,473,014 | 20.2% | 2,236,507 |
| Team immunity 1st | 4,009,875 | 18.1% | 1,336,625 |
| Survival (post-merge) | 2,765,805 | 12.5% | 921,935 |
| team_reward_first | 2,682,036 | 12.1% | 1,341,018 |
| Survival (swap) | 2,079,446 | 9.4% | 1,039,723 |
| strategic_player | 1,241,044 | 5.6% | 310,261 |
| team_immunity_second_three | 782,707 | 3.5% | 782,707 |
| team_reward_second_three | 782,679 | 3.5% | 782,679 |
| Individual immunity | 603,715 | 2.7% | 120,743 |
| Final tribal | 247,210 | 1.1% | 49,442 |
| Win season | 142,938 | 0.6% | 15,882 |
| idol_play | 79,450 | 0.4% | 11,350 |
| clue_read | 56,219 | 0.3% | 56,219 |
| advantage_play | 28,368 | 0.1% | 7,092 |
| team_immunity_second_two | 0 | 0.0% | 555,239 |
| team_reward_second_two | 0 | 0.0% | 553,084 |
| idol_failure | -20,308 | -0.1% | 10,154 |
| team_immunity_last | -781,411 | -3.5% | 781,411 |
| Voted out | -3,423,529 | -15.5% | 309,358 |

---

## Contestant Prices & Expected Points

| Contestant | Tribe | Expected Pts | Price |
|------------|-------|--------------|-------|
| c05 | Tribe A | 68.9 | $207,500 |
| c21 | Tribe C | 68.9 | $207,500 |
| c13 | Tribe B | 67.2 | $192,500 |
| c23 | Tribe C | 65.1 | $170,000 |
| c11 | Tribe B | 63.7 | $157,500 |
| c07 | Tribe A | 63.4 | $155,000 |
| c17 | Tribe C | 63.3 | $152,500 |
| c01 | Tribe A | 62.9 | $150,000 |
| c15 | Tribe B | 62.8 | $150,000 |
| c19 | Tribe C | 62.8 | $150,000 |
| c09 | Tribe B | 62.4 | $147,500 |
| c03 | Tribe A | 62.2 | $145,000 |
| c24 | Tribe C | 59.9 | $127,500 |
| c08 | Tribe A | 59.9 | $127,500 |
| c10 | Tribe B | 59.6 | $125,000 |
| c18 | Tribe C | 59.3 | $125,000 |
| c02 | Tribe A | 58.0 | $115,000 |
| c16 | Tribe B | 57.8 | $115,000 |
| c20 | Tribe C | 55.1 | $102,500 |
| c04 | Tribe A | 54.7 | $102,500 |
| c12 | Tribe B | 54.2 | $102,500 |
| c06 | Tribe A | 51.3 | $102,500 |
| c22 | Tribe C | 49.4 | $102,500 |
| c14 | Tribe B | 47.6 | $102,500 |

---

## Strategy Descriptions

| Strategy | Description |
|----------|-------------|
| **max_expected** | Picks up to 7 highest expected-point players under budget (min 1 per tribe). |
| **value** | Picks players with best points-per-dollar. Favors cheaper players; typically 7 mid-tier. |
| **balanced** | Value (pts/price) with tiebreaker toward higher expected. |
| **mid_tier** | Only considers middle 50% of expected points. Avoids expensive stars and weak scrubs. |
| **stars_and_scrubs** | Picks 2 expensive stars, then fills with cheapest (min 1 per tribe). |
| **five_premium** | Exactly 5 premium players (highest expected, min 1 per tribe). Tests 5-stars viability. |
| **six_premium** | Exactly 6 premium players (min 1 per tribe). Tests 6-stars vs 7-mid tradeoff. |
| **random** | Randomly selects valid rosters under budget. |

---

## Strategy Performance (Budget-Constrained Rosters)

| Strategy | Avg Score | Avg Cost | Min | Max | Count |
|----------|-----------|----------|-----|-----|-------|
| max_expected | 338.5 | $935,000 | 127 | 536 | 7500 |
| value | 377.6 | $742,500 | 128 | 666 | 7500 |
| balanced | 338.5 | $935,000 | 127 | 536 | 7500 |
| mid_tier | 407.5 | $880,000 | 146 | 704 | 7500 |
| stars_and_scrubs | 406.8 | $927,500 | 135 | 720 | 7500 |
| five_premium | 338.5 | $935,000 | 127 | 536 | 7500 |
| six_premium | 338.5 | $935,000 | 127 | 536 | 7500 |
| random | 405.5 | $932,600 | 85 | 727 | 7500 |

---

## Example Rosters & Top Picks by Strategy

### max_expected

- **Example roster:** c05, c11, c13, c21, c23 (5 players)
- **Cost:** $935,000 | **Expected pts (sum):** 333.8
- **Most picked:** c05 (100%), c13 (100%), c21 (100%), c23 (100%), c11 (100%)

### value

- **Example roster:** c02, c04, c06, c12, c16, c20, c22 (7 players)
- **Cost:** $742,500 | **Expected pts (sum):** 380.4
- **Most picked:** c04 (100%), c12 (100%), c20 (100%), c02 (100%), c16 (100%)

### balanced

- **Example roster:** c05, c11, c13, c21, c23 (5 players)
- **Cost:** $935,000 | **Expected pts (sum):** 333.8
- **Most picked:** c05 (100%), c13 (100%), c21 (100%), c23 (100%), c11 (100%)

### mid_tier

- **Example roster:** c02, c03, c08, c10, c16, c18, c24 (7 players)
- **Cost:** $880,000 | **Expected pts (sum):** 416.6
- **Most picked:** c02 (100%), c16 (100%), c18 (100%), c10 (100%), c24 (100%)

### stars_and_scrubs

- **Example roster:** c04, c05, c06, c12, c14, c20, c21 (7 players)
- **Cost:** $927,500 | **Expected pts (sum):** 400.6
- **Most picked:** c05 (100%), c21 (100%), c12 (100%), c04 (100%), c06 (100%)

### five_premium

- **Example roster:** c05, c11, c13, c21, c23 (5 players)
- **Cost:** $935,000 | **Expected pts (sum):** 333.8
- **Most picked:** c05 (100%), c13 (100%), c21 (100%), c23 (100%), c11 (100%)

### six_premium

- **Example roster:** c05, c11, c13, c21, c23 (5 players)
- **Cost:** $935,000 | **Expected pts (sum):** 333.8
- **Most picked:** c05 (100%), c13 (100%), c21 (100%), c23 (100%), c11 (100%)

### random

- **Example roster:** c07, c10, c14, c15, c16, c19, c22 (7 players)
- **Cost:** $900,000 | **Expected pts (sum):** 403.3
- **Most picked:** c16 (44%), c19 (44%), c02 (44%), c22 (40%), c14 (40%)

---

## Findings

1. **Price spread:** $102,500–$207,500 in $2,500 increments.
2. **Total valid team options:** 204,226 distinct roster combinations under budget (min 1 per tribe, 7 players).
3. **Rosters tested:** 29 unique compositions scored across 300 scenarios.
4. **7 players required:** All rosters must have exactly 7 players; top 7 by price > budget (cannot own all 7 most expensive).
5. **Pricing constraint:** 34.5% of tribe-valid team combinations excluded by budget (target ~25%).
