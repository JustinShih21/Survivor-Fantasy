# Survivor Fantasy Simulation — Compiled Report

**Generated:** February 19, 2025  
**Purpose:** Consolidated output from pricing and dynamic pricing simulations for Survivor S50 fantasy system.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total valid team options** | 234,727 |
| **Excluded by pricing** | 24.7% |
| **Merge valid % (target 70%)** | 70.3% |
| **Price range** | $85,000 – $217,500 |
| **Budget** | $1,000,000 |

---

## 1. Pricing System Overview

### Initial Pricing (Pre-Season)

- **Roster rules:** Exactly 7 players, minimum 1 per tribe (Tribe A, B, C)
- **Price bounds:** $80,000 – $260,000 (increments of $2,500)
- **Calibration:** Top 7 by expected points sum to $1,270,000 (exceeds budget) — cannot own all 7 most expensive
- **Target:** ~75% of tribe-valid combos under budget; ~25% excluded

### Price Distribution (Current Run)

| Metric | Value |
|--------|-------|
| Min price | $85,000 |
| Max price | $217,500 |
| Top 5 cost | $965,000 |
| Top 6 cost | $1,117,500 |
| Top 7 cost | $1,270,000 |

### Players by Price Tier

| Price | Contestants |
|-------|-------------|
| $217,500 | c21, c05 |
| $197,500 | c13 |
| $170,000 | c23 |
| $162,500 | c11 |
| $152,500 | c17, c07 |
| $150,000 | c15, c19 |
| $147,500 | c01 |
| $145,000 | c09 |
| $142,500 | c03 |
| $122,500 | c08 |
| $120,000 | c18, c10, c24 |
| $107,500 | c02, c16 |
| $87,500 | c20, c04 |
| $85,000 | c12, c06, c22, c14 |

---

## 2. Dynamic (Episode-Reactive) Pricing

### How It Works

After each tribal episode:

1. **Performance delta** — Prices move based on points earned (survival, immunity, vote matched, etc.)
2. **Diversity compression** — Pulls prices toward median (scales up as season progresses)
3. **Season inflation** — Multiply by ~1.059 per episode → ~2x by merge
4. **Dynamic bounds** — price_min/max scale with progress (2x at merge: 160k–520k)

### Key Parameters

| Parameter | Value |
|-----------|-------|
| price_reactivity | 0.15 |
| diversity_compression (base→late) | 0.25 → 0.45 |
| value_tolerance (base→max) | 0.10 → 0.18 |
| merge_price_multiplier | 2.0 |
| merge_episodes | 12 |
| merge_budget | $1,780,000 |

### Replacement Diversity Results

| Metric | Value |
|--------|-------|
| Replacement events simulated | 1,050 |
| Avg viable options per event | 2.0 |
| % of events with 3+ viable options | 19.2% |
| Merge events (10–12 players) | 150 |
| Avg % valid at merge | 70.3% |

---

## 3. Point Scoring Breakdown

### Category Totals (Aggregate)

| Category | Total Points | % of Total |
|----------|--------------|------------|
| Survival | 9,300,931 | 42.0% |
| Challenges | 8,079,576 | 36.5% |
| Tribal | 6,385,422 | 28.9% |
| Advantages | 1,422,548 | 6.4% |
| Placement | 391,979 | 1.8% |
| Penalties | -3,457,014 | -15.6% |

### Event-Level Breakdown

| Event Type | Total Points | % of Total |
|------------|--------------|------------|
| Vote matched | 6,385,422 | 28.9% |
| Survival (pre-merge) | 4,477,218 | 20.2% |
| Team immunity 1st | 4,011,582 | 18.1% |
| Survival (post-merge) | 2,749,977 | 12.4% |
| Team reward 1st | 2,663,272 | 12.0% |
| Survival (swap) | 2,073,736 | 9.4% |
| Strategic player | 1,256,368 | 5.7% |
| Individual immunity | 620,300 | 2.8% |
| Final tribal | 245,495 | 1.1% |
| Win season | 146,484 | 0.7% |
| Idol play | 80,052 | 0.4% |
| Clue read | 57,240 | 0.3% |
| Advantage play | 28,888 | 0.1% |
| Idol failure | -20,820 | -0.1% |
| Team immunity last | -782,630 | -3.5% |
| Voted out | -3,436,194 | -15.5% |

---

## 4. Roster Strategies & Performance

| Strategy | Avg Score | Avg Cost | Description |
|----------|-----------|----------|-------------|
| **random** | 411.6 | $899,500 | Random valid rosters under budget |
| **mid_tier** | 408.3 | $840,000 | Middle 50% expected points only |
| **stars_and_scrubs** | 405.2 | $862,500 | 2 stars + cheapest fill |
| **value** | 371.2 | $622,500 | Best points-per-dollar |
| **max_expected** | 338.4 | $965,000 | Highest expected points |
| **balanced** | 338.4 | $965,000 | Value with expected tiebreaker |
| **five_premium** | 338.4 | $965,000 | Exactly 5 premium players |
| **six_premium** | 338.4 | $965,000 | Exactly 6 premium players |

**Note:** Premium-heavy strategies (max_expected, five_premium, six_premium) underperform value and mid-tier strategies in this simulation, as they spend more on fewer players who may be voted out early.

---

## 5. Simulation Parameters

### Pricing Simulation

- **Price estimation runs:** 2,000 Monte Carlo scenarios
- **Scenario runs (scoring):** 300
- **Unique roster compositions tested:** 29
- **Roster strategies:** 8 (max_expected, value, balanced, mid_tier, stars_and_scrubs, five_premium, six_premium, random)

### Dynamic Pricing Simulation

- **Scenarios:** 50 full seasons
- **Merge detection:** When 10–12 players remain
- **Budget at merge:** $1,780,000 (tuned for ~70% valid)

---

## 6. Key Findings

1. **Pricing constraint achieved** — Top 7 most expensive exceed budget; ~25% of combos excluded.
2. **Merge inflation on target** — 70.3% of merge combos valid under $1.78M budget.
3. **Replacement diversity** — 19.2% of vote-off events have 3+ viable replacements; edge cases (0 affordable) preserved for tradeoff decisions.
4. **Point distribution** — Survival (42%) and challenges (36.5%) dominate; voted-out penalty (-15.5%) is significant.
5. **Strategy variance** — Value and mid-tier strategies outperform premium-heavy builds in this no-replacement model.

---

## 7. Source Files

| Report | Description |
|--------|-------------|
| `pricing_report.md` | Phase 1 pricing simulation output |
| `DYNAMIC_PRICING_REPORT.md` | Episode-reactive pricing and replacement diversity |
| `pricing_analysis.json` | Raw pricing and strategy stats |
| `dynamic_pricing_analysis.json` | Raw dynamic pricing stats |
| `report.md` | Point simulation methodology |
