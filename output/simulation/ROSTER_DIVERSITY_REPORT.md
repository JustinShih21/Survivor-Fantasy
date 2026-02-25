# Roster Diversity & Total Team Options Report

**Simulation:** Phase 1 Pricing with Sampled Rosters

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total valid team options** | 236,095 |
| **Rosters tested in simulation** | 500 |
| **Scenarios per roster** | 300 |
| **Total simulation runs** | 150,000 |

---

## Total Valid Team Options

Given: Budget $1M, 5–7 players, min 1 per tribe, 24 contestants.

| Roster Size | Valid Combinations |
|-------------|---------------------|
| 5 players | 0 |
| 6 players | 0 |
| 7 players | 236,095 |
| **Total** | **236,095** |

---

## Simulation Results

| Metric | Value |
|--------|-------|
| Avg score | 414.7 |
| Min score | 58 |
| Max score | 823 |
| Avg cost | $899,615 |
| Unique rosters tested | 500 |

---

## How to Run

```bash
python run_pricing_simulation.py --sample-rosters 500 --output ../../output/simulation
```
