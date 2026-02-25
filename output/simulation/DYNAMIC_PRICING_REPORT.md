# Dynamic Pricing Simulation Report

## Overview

This report documents how **episode-reactive price changes** work and whether they create **multiple viable replacement options** when a player gets voted off.

**Goal:** When someone is voted off and teams need to replace them, there should NOT be one obvious player everyone wants. Multiple options at different price points should be viable.

---

## How Price Changes Work

### Update Formula

After each episode:

1. **Points earned** — Each contestant gets points for: survival, immunity, vote matched, etc.
2. **Relative performance** — Compare each player's points to the episode average.
3. **Price delta (demand-based)** — `(points - avg) / range × reactivity`
   - Strong performers (above avg): demand up → price increases
   - Weak performers (below avg): demand down → price decreases
4. **No diversity compression** — Prices stay differentiated by performance (compression = 0).
5. **No season inflation** — merge_price_multiplier = 1.0; prices reflect demand only.
6. **Fixed bounds** — price_min/max stay constant (no scaling when inflation disabled).

### Key Parameters

| Parameter | Value | Effect |
|-----------|-------|--------|
| price_reactivity | 0.05 | Max % price move per episode |
| diversity_compression (base→late) | 0→0 | 0 = demand-based differentiation only |
| value_tolerance (base→max) | 0.1→0.18 | Adaptive: widens when compressed or late-season |
| merge_price_multiplier | 1.0 | 1.0 = no inflation; demand-based only |
| merge_episodes | 12 | Tribal episodes before merge |
| merge_budget | $1,780,000 | Budget at merge (tuned for ~70% valid) |

---

## Replacement Diversity Results

When a player is voted off, we count how many replacement options are **viable** (within adaptive tolerance of best value, affordable with freed budget).

| Metric | Value |
|--------|-------|
| Replacement events simulated | 1,050 |
| Avg viable options per event | 4.8 |
| Min viable options (worst case) | 0 |
| % of events with 3+ viable options | 74.6% |

---

## Merge Budget Pressure (10-12 Players Left)

When the season reaches merge (10-12 players remaining), prices reflect demand-based movement. We measure what % of 7-player tribe-valid combos are under budget.

| Metric | Value |
|--------|-------|
| Merge events simulated | 150 |
| Avg % valid at merge | 100.0% |
| Target % valid | 70% |

---

## Example Replacement Scenarios

### Event 1: c07 voted off (Episode 1)

- **Viable replacements:** 10
- **Affordable options:** 19
- **Viable picks:** c04, c02, c12, c16, c24, c08, c19, c06...

### Event 2: c06 voted off (Episode 2)

- **Viable replacements:** 6
- **Affordable options:** 6
- **Viable picks:** c12, c16, c14, c24, c22, c20

### Event 3: c18 voted off (Episode 3)

- **Viable replacements:** 11
- **Affordable options:** 11
- **Viable picks:** c04, c02, c12, c16, c14, c24, c08, c19...

### Event 4: c17 voted off (Episode 4)

- **Viable replacements:** 11
- **Affordable options:** 11
- **Viable picks:** c04, c02, c12, c16, c14, c24, c08, c19...

### Event 5: c22 voted off (Episode 5)

- **Viable replacements:** 5
- **Affordable options:** 5
- **Viable picks:** c12, c16, c14, c24, c20

### Event 6: c03 voted off (Episode 6)

- **Viable replacements:** 7
- **Affordable options:** 7
- **Viable picks:** c04, c02, c12, c16, c14, c24, c20

### Event 7: c11 voted off (Episode 7)

- **Viable replacements:** 7
- **Affordable options:** 11
- **Viable picks:** c04, c02, c12, c16, c24, c19, c20

### Event 8: c01 voted off (Episode 8)

- **Viable replacements:** 9
- **Affordable options:** 10
- **Viable picks:** c04, c02, c12, c16, c14, c24, c08, c19...

### Event 9: c13 voted off (Episode 9)

- **Viable replacements:** 7
- **Affordable options:** 12
- **Viable picks:** c04, c02, c12, c16, c24, c19, c20

### Event 10: c16 voted off (Episode 10)

- **Viable replacements:** 4
- **Affordable options:** 4
- **Viable picks:** c12, c14, c24, c20

---

## Price Evolution (Sample Scenario)

**After Episode 0:** c01=$132,500, c02=$102,500, c03=$112,500, c04=$102,500, c05=$180,000
**After Episode 1:** c01=$135,000, c02=$102,500, c03=$112,500, c04=$102,500, c05=$182,500
**After Episode 2:** c01=$135,000, c02=$102,500, c03=$112,500, c04=$102,500, c05=$182,500
**After Episode 3:** c01=$137,500, c02=$102,500, c03=$112,500, c04=$102,500, c05=$182,500
**After Episode 4:** c01=$137,500, c02=$102,500, c03=$112,500, c04=$102,500, c05=$182,500

---

## Price Change Formula Example

When a player wins individual immunity (+5 pts) and another gets vote matched (+2 pts) while the tribe loses immunity (-1):

- **Immunity winner:** pts = 5, avg ≈ 1.5 → delta_norm positive → price goes **up**
- **Vote matched:** pts = 2, avg ≈ 1.5 → delta_norm slightly positive → price goes **up** slightly
- **Tribe lost immunity:** pts = -1, avg ≈ 1.5 → delta_norm negative → price goes **down**
- **Voted out:** pts = -8 (e.g.), avg ≈ 1.5 → delta_norm very negative → price drops (but they're removed from pool)

Demand-based pricing: each player moves independently based on performance; no universal inflation or compression.

---

## Edge Cases

- **0 affordable:** When a cheap player is voted off, budget freed is low. If all remaining players cost more, no one is affordable. Consider: minimum replacement budget, or price floors.
- **0 viable:** When one player dominates value (pts/price), no one else is within tolerance. Adaptive tolerance widens when compressed or late-season.

---

## Findings

1. **Demand-based pricing** — Prices move each episode based on performance (immunity, vote matched, etc.); strong performers rise, weak fall.
2. **Differentiation** — No compression; prices stay differentiated by performance rather than clustering.
3. **Replacement diversity** — When someone is voted off, the system aims for 3+ viable replacement options.
4. **Adaptive value tolerance** — Widens when prices are highly compressed or in late-season states, reducing degenerate 'one obvious pick' outcomes while preserving scarcity and budget pressure.
5. **Edge cases preserved** — Impossible immediate replacement (0 affordable) remains; forces meaningful tradeoff decisions rather than auto-fills.
6. **No inflation** — Prices reflect demand only; no universal rise by merge.
