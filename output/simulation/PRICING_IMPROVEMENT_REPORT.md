# Pricing System Improvement Report

**Date:** February 19, 2025  
**Purpose:** Document changes made to increase unique roster combinations and improve roster diversity.

---

## Summary of Changes

Three improvements were implemented to increase the number of viable, distinct roster combinations:

| Change | Before | After |
|--------|--------|-------|
| **target_top5_sum** | $950,000 | $900,000 |
| **price_increment** | $5,000 | $2,500 |
| **Tie-breaking** | Deterministic (first match) | Random among ties |

---

## 1. Pricing Configuration (`config/pricing.yaml`)

### target_top5_sum: $950,000 → $900,000

**Rationale:** With top 5 at exactly budget, there was no slack for tradeoffs. Lowering to $900K creates ~$100K of headroom, enabling:

- **6-player premium rosters** — A 6th mid-tier player can now fit under budget alongside 5 premium picks
- **Swaps within premium tier** — e.g., swap one $170K player for a $145K player and add a value pick
- **More viable combinations** — Multiple roster compositions can now hit the budget

### price_increment: $5,000 → $2,500

**Rationale:** Finer granularity creates more distinct price points (37 vs 37 in range, but more precise rounding). This allows:

- More precise budget allocation
- Fewer players clustered at identical prices
- More meaningful tradeoff decisions between similar players

---

## 2. Roster Generator Tie-Breaking (`src/roster_generator.py`)

When multiple players had identical scores (expected points, value ratio, etc.), the generator always picked the first in sorted order. This made strategies like `max_expected`, `value`, `balanced`, and `mid_tier` fully deterministic.

**Changes:**

- **`generate_budget_roster`:** When picking by score, if multiple candidates tie for best score, choose randomly among them
- **`_generate_premium_roster`:** When picking best by expected points (per tribe or fill slots), break ties randomly
- **`_generate_stars_and_scrubs`:** When picking 2 stars by expected points, break ties randomly

**Effect:** Strategies that previously produced the same roster every run can now produce variation when ties occur.

---

## 3. Simulation Parameters

- **Rosters per strategy:** Increased from 15 to 25 (in `run_pricing_simulation.py`) to better exercise tie-breaking and capture roster diversity
- **Price estimation runs:** 2,000  
- **Scenario runs:** 300  

---

## Before vs After Comparison

| Metric | Before | After |
|--------|--------|-------|
| **Unique roster compositions** | 29 | 30 |
| **Top 5 by expected (cost)** | $950,000 | ~$902,500 |
| **Top 6 by expected (cost)** | $1,095,000 | ~$1,047,500 |
| **Price increments** | $5,000 | $2,500 |
| **6-premium viable?** | No (fell back to 5) | Yes |

### Strategy Behavior Changes

| Strategy | Before | After |
|----------|--------|-------|
| **max_expected** | 5 players (c05, c07, c13, c21, c23), $950K | 6 players (c05, c11, c13, c20, c21, c23), ~$987K |
| **six_premium** | 5 players (same as five_premium) | 6 players (c05, c11, c13, c20, c21, c23) |
| **five_premium** | 5 players | 5 players (c05, c11, c13, c21, c23) |

**Key improvement:** The `six_premium` strategy now successfully builds 6-player premium rosters instead of falling back to 5, validating that 6 premium players can fit under budget with the new pricing.

---

## New Simulation Results

See `pricing_report.md` and `pricing_analysis.json` in this directory for the full output of the latest run.

### Highlights

- **Unique rosters:** 30 (slight increase; more variety possible with additional rosters per strategy)
- **6-premium rosters:** Now viable — max_expected, balanced, and six_premium all build 6-player rosters
- **Price spread:** $80,000–$207,500 in $2,500 increments
- **Strategy performance:** mid_tier (413.3 avg), random (411.0), stars_and_scrubs (403.7) remain competitive

---

## Recommendations for Further Improvement

If more roster diversity is desired:

1. **Increase rosters per strategy** — e.g., `--rosters 40` or higher
2. **Flatten price curve** — Try `price_curve: 1.4` to compress the spread and create more mid-tier tradeoffs
3. **Lower target_top5_sum further** — e.g., $850K to allow 6 premium players to fit more comfortably
4. **Widen price range** — Lower `price_min` or raise `price_max` for more distinct tiers

---

## Files Modified

- `scripts/point_simulation/config/pricing.yaml` — target_top5_sum, price_increment
- `scripts/point_simulation/src/roster_generator.py` — tie-breaking in generate_budget_roster, _generate_premium_roster, _generate_stars_and_scrubs
- `scripts/point_simulation/run_pricing_simulation.py` — default rosters per strategy (15→25), dynamic price increment in report
