# Episode Trace: Week-by-Week Simulation

**Scenario seed:** 42 — run `python run_episode_trace_simulation.py --seed 123` for different outcomes.

Shows how prices change, who gets voted out, and how fantasy teams are affected.
**Transfer rules:** Sell = no penalty; Add = -10 pts per add.

---

## Sample Teams (Final Results)

### value

- **Fixed (no replace):** 522 pts — roster: c02, c16, c24, c04, c12, c03, c19
- **Replace (when viable):** 516 pts — roster: c12, c12, c12
- Initial cost: $787,500 / $1,000,000 budget

### mid_tier

- **Fixed (no replace):** 615 pts — roster: c02, c10, c24, c04, c03, c19, c18
- **Replace (when viable):** 642 pts — roster: c10, c12, c12
- Initial cost: $837,500 / $1,000,000 budget

### random

- **Fixed (no replace):** 442 pts — roster: c07, c16, c22, c14, c10, c19, c15
- **Replace (when viable):** 512 pts — roster: c10, c12, c12, c10
- Initial cost: $912,500 / $1,000,000 budget

---

## Week-by-Week Breakdown

### Episode 1 (pre_merge)

**Voted out:** c07 (Contestant 07)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c07 (Contestant 07) | $172,500 | $165,000 | -7,500 (-4.3%) |
| c01 (Contestant 01) | $135,000 | $137,500 | +2,500 (+1.9%) |
| c03 (Contestant 03) | $122,500 | $125,000 | +2,500 (+2.0%) |
| c05 (Contestant 05) | $192,500 | $195,000 | +2,500 (+1.3%) |
| c08 (Contestant 08) | $132,500 | $135,000 | +2,500 (+1.9%) |
| c18 (Contestant 18) | $125,000 | $127,500 | +2,500 (+2.0%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 54.0 | 54.0 | — | c03 |
| value | replace | 54.0 | 54.0 | — | c03 |
| mid_tier | fixed | 50.0 | 50.0 | — | c10 |
| mid_tier | replace | 50.0 | 50.0 | — | c10 |
| random | fixed | 0.0 | 0.0 | — | c07 |
| random | replace | 0.0 | -10.0 | c07 → c19 ($172,500 freed, 10 viable, add penalty -10) | c07 |

---

### Episode 2 (pre_merge)

**Voted out:** c06 (Contestant 06)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c02 (Contestant 02) | $110,000 | $112,500 | +2,500 (+2.3%) |
| c06 (Contestant 06) | $107,500 | $105,000 | -2,500 (-2.3%) |
| c21 (Contestant 21) | $237,500 | $240,000 | +2,500 (+1.1%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 48.0 | 102.0 | — | c03 |
| value | replace | 48.0 | 102.0 | — | c03 |
| mid_tier | fixed | 50.0 | 100.0 | — | c10 |
| mid_tier | replace | 50.0 | 100.0 | — | c10 |
| random | fixed | 32.0 | 32.0 | — | c15 |
| random | replace | 39.0 | 29.0 | — | c15 |

---

### Episode 3 (pre_merge)

**Voted out:** c18 (Contestant 18)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c18 (Contestant 18) | $127,500 | $122,500 | -5,000 (-3.9%) |
| c05 (Contestant 05) | $195,000 | $197,500 | +2,500 (+1.3%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 46.0 | 148.0 | — | c03 |
| value | replace | 46.0 | 148.0 | — | c03 |
| mid_tier | fixed | 29.0 | 129.0 | — | c10 |
| mid_tier | replace | 29.0 | 119.0 | c18 → c19 ($127,500 freed, 10 viable, add penalty -10) | c10 |
| random | fixed | 39.0 | 71.0 | — | c15 |
| random | replace | 42.0 | 71.0 | — | c15 |

---

### Episode 4 (pre_merge)

**Voted out:** c17 (Contestant 17)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c17 (Contestant 17) | $142,500 | $137,500 | -5,000 (-3.5%) |
| c13 (Contestant 13) | $177,500 | $180,000 | +2,500 (+1.4%) |
| c21 (Contestant 21) | $240,000 | $242,500 | +2,500 (+1.0%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 50.0 | 198.0 | — | c03 |
| value | replace | 50.0 | 198.0 | — | c03 |
| mid_tier | fixed | 43.0 | 172.0 | — | c10 |
| mid_tier | replace | 50.0 | 169.0 | — | c10 |
| random | fixed | 32.0 | 103.0 | — | c15 |
| random | replace | 39.0 | 110.0 | — | c15 |

---

### Episode 5 (pre_merge)

**Voted out:** c22 (Contestant 22)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c22 (Contestant 22) | $107,500 | $102,500 | -5,000 (-4.7%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 52.0 | 250.0 | — | c03 |
| value | replace | 52.0 | 250.0 | — | c03 |
| mid_tier | fixed | 44.0 | 216.0 | — | c10 |
| mid_tier | replace | 49.0 | 218.0 | — | c10 |
| random | fixed | 29.0 | 132.0 | — | c15 |
| random | replace | 34.0 | 134.0 | c22 → c24 ($107,500 freed, 5 viable, add penalty -10) | c15 |

---

### Episode 6 (pre_merge)

**Voted out:** c03 (Contestant 03)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c03 (Contestant 03) | $125,000 | $120,000 | -5,000 (-4.0%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 20.0 | 270.0 | — | c03 |
| value | replace | 20.0 | 260.0 | c03 → c19 ($125,000 freed, 8 viable, add penalty -10) | c03 |
| mid_tier | fixed | 25.0 | 241.0 | — | c10 |
| mid_tier | replace | 30.0 | 238.0 | c03 → c19 ($125,000 freed, 8 viable, add penalty -10) | c10 |
| random | fixed | 37.0 | 169.0 | — | c15 |
| random | replace | 51.0 | 185.0 | — | c15 |

---

### Episode 7 (pre_merge)

**Voted out:** c11 (Contestant 11)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c11 (Contestant 11) | $152,500 | $147,500 | -5,000 (-3.3%) |
| c02 (Contestant 02) | $112,500 | $115,000 | +2,500 (+2.2%) |
| c21 (Contestant 21) | $242,500 | $245,000 | +2,500 (+1.0%) |
| c23 (Contestant 23) | $195,000 | $197,500 | +2,500 (+1.3%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 46.0 | 316.0 | — | c19 |
| value | replace | 60.0 | 320.0 | — | c19 |
| mid_tier | fixed | 39.0 | 280.0 | — | c10 |
| mid_tier | replace | 53.0 | 291.0 | — | c10 |
| random | fixed | 20.0 | 189.0 | — | c15 |
| random | replace | 36.0 | 221.0 | — | c15 |

---

### Episode 8 (swap)

**Voted out:** c01 (Contestant 01)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c01 (Contestant 01) | $137,500 | $132,500 | -5,000 (-3.6%) |
| c16 (Contestant 16) | $107,500 | $110,000 | +2,500 (+2.3%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 42.0 | 358.0 | — | c19 |
| value | replace | 50.0 | 370.0 | — | c19 |
| mid_tier | fixed | 32.0 | 312.0 | — | c10 |
| mid_tier | replace | 40.0 | 331.0 | — | c10 |
| random | fixed | 41.0 | 230.0 | — | c15 |
| random | replace | 49.0 | 270.0 | — | c15 |

---

### Episode 9 (swap)

**Voted out:** c13 (Contestant 13)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c13 (Contestant 13) | $180,000 | $172,500 | -7,500 (-4.2%) |
| c05 (Contestant 05) | $197,500 | $200,000 | +2,500 (+1.3%) |
| c23 (Contestant 23) | $197,500 | $200,000 | +2,500 (+1.3%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 49.0 | 407.0 | — | c19 |
| value | replace | 63.0 | 433.0 | — | c19 |
| mid_tier | fixed | 50.0 | 362.0 | — | c10 |
| mid_tier | replace | 64.0 | 395.0 | — | c10 |
| random | fixed | 35.0 | 265.0 | — | c15 |
| random | replace | 51.0 | 321.0 | — | c15 |

---

### Episode 10 (swap)

**Voted out:** c16 (Contestant 16)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c16 (Contestant 16) | $110,000 | $105,000 | -5,000 (-4.5%) |
| c09 (Contestant 09) | $152,500 | $155,000 | +2,500 (+1.6%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 24.0 | 431.0 | — | c19 |
| value | replace | 36.0 | 459.0 | c16 → c24 ($110,000 freed, 5 viable, add penalty -10) | c19 |
| mid_tier | fixed | 36.0 | 398.0 | — | c10 |
| mid_tier | replace | 48.0 | 443.0 | — | c10 |
| random | fixed | 17.0 | 282.0 | — | c15 |
| random | replace | 29.0 | 340.0 | c16 → c24 ($110,000 freed, 5 viable, add penalty -10) | c15 |

---

### Episode 11 (swap)

**Voted out:** c14 (Contestant 14)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c14 (Contestant 14) | $107,500 | $102,500 | -5,000 (-4.7%) |
| c10 (Contestant 10) | $140,000 | $142,500 | +2,500 (+1.8%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 37.0 | 468.0 | — | c19 |
| value | replace | 58.0 | 517.0 | — | c19 |
| mid_tier | fixed | 48.0 | 446.0 | — | c10 |
| mid_tier | replace | 62.0 | 505.0 | — | c10 |
| random | fixed | 17.0 | 299.0 | — | c15 |
| random | replace | 38.0 | 368.0 | c14 → c24 ($107,500 freed, 3 viable, add penalty -10) | c15 |

---

### Episode 12 (swap)

**Voted out:** c20 (Contestant 20)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c20 (Contestant 20) | $107,500 | $102,500 | -5,000 (-4.7%) |
| c05 (Contestant 05) | $200,000 | $202,500 | +2,500 (+1.2%) |
| c21 (Contestant 21) | $245,000 | $247,500 | +2,500 (+1.0%) |
| c23 (Contestant 23) | $200,000 | $202,500 | +2,500 (+1.2%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 43.0 | 511.0 | — | c19 |
| value | replace | 66.0 | 583.0 | — | c19 |
| mid_tier | fixed | 52.0 | 498.0 | — | c10 |
| mid_tier | replace | 66.0 | 571.0 | — | c10 |
| random | fixed | 24.0 | 323.0 | — | c15 |
| random | replace | 58.0 | 426.0 | — | c15 |

---

### Episode 13 (post_merge)

**Voted out:** c09 (Contestant 09)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c09 (Contestant 09) | $155,000 | $150,000 | -5,000 (-3.2%) |
| c08 (Contestant 08) | $135,000 | $137,500 | +2,500 (+1.9%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 32.0 | 543.0 | — | c19 |
| value | replace | 47.0 | 630.0 | — | c19 |
| mid_tier | fixed | 28.0 | 526.0 | — | c10 |
| mid_tier | replace | 38.0 | 609.0 | — | c10 |
| random | fixed | 20.0 | 343.0 | — | c15 |
| random | replace | 40.0 | 466.0 | — | c15 |

---

### Episode 14 (post_merge)

**Voted out:** c04 (Contestant 04)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c04 (Contestant 04) | $110,000 | $107,500 | -2,500 (-2.3%) |
| c19 (Contestant 19) | $122,500 | $125,000 | +2,500 (+2.0%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 21.0 | 564.0 | — | c19 |
| value | replace | 54.0 | 674.0 | c04 → c24 ($110,000 freed, 2 viable, add penalty -10) | c19 |
| mid_tier | fixed | 14.0 | 540.0 | — | c10 |
| mid_tier | replace | 42.0 | 641.0 | c04 → c24 ($110,000 freed, 2 viable, add penalty -10) | c10 |
| random | fixed | 25.0 | 368.0 | — | c15 |
| random | replace | 54.0 | 520.0 | — | c15 |

---

### Episode 15 (post_merge)

**Voted out:** c24 (Contestant 24)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c24 (Contestant 24) | $107,500 | $102,500 | -5,000 (-4.7%) |
| c05 (Contestant 05) | $202,500 | $205,000 | +2,500 (+1.2%) |
| c15 (Contestant 15) | $155,000 | $157,500 | +2,500 (+1.6%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 4.0 | 568.0 | — | c19 |
| value | replace | -14.0 | 650.0 | c24 → c12 ($107,500 freed, 1 viable, add penalty -10) | c19 |
| mid_tier | fixed | 6.0 | 546.0 | — | c10 |
| mid_tier | replace | 2.0 | 633.0 | c24 → c12 ($107,500 freed, 1 viable, add penalty -10) | c10 |
| random | fixed | 26.0 | 394.0 | — | c15 |
| random | replace | -11.0 | 499.0 | c24 → c12 ($107,500 freed, 1 viable, add penalty -10) | c15 |

---

### Episode 16 (post_merge)

**Voted out:** c05 (Contestant 05)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c05 (Contestant 05) | $205,000 | $197,500 | -7,500 (-3.7%) |
| c08 (Contestant 08) | $137,500 | $140,000 | +2,500 (+1.8%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 26.0 | 594.0 | — | c19 |
| value | replace | 49.0 | 699.0 | — | c19 |
| mid_tier | fixed | 18.0 | 564.0 | — | c10 |
| mid_tier | replace | 41.0 | 674.0 | — | c10 |
| random | fixed | 22.0 | 416.0 | — | c15 |
| random | replace | 36.0 | 535.0 | — | c15 |

---

### Episode 17 (post_merge)

**Voted out:** c19 (Contestant 19)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c19 (Contestant 19) | $125,000 | $120,000 | -5,000 (-4.0%) |
| c15 (Contestant 15) | $157,500 | $160,000 | +2,500 (+1.6%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | -33.0 | 561.0 | — | c19 |
| value | replace | -71.0 | 618.0 | c19 → c02 ($125,000 freed, 2 viable, add penalty -10) | c19 |
| mid_tier | fixed | -9.0 | 555.0 | — | c10 |
| mid_tier | replace | -47.0 | 617.0 | c19 → c02 ($125,000 freed, 2 viable, add penalty -10) | c10 |
| random | fixed | -1.0 | 415.0 | — | c15 |
| random | replace | -15.0 | 510.0 | c19 → c02 ($125,000 freed, 2 viable, add penalty -10) | c15 |

---

### Episode 18 (post_merge)

**Voted out:** c02 (Contestant 02)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c02 (Contestant 02) | $115,000 | $110,000 | -5,000 (-4.3%) |
| c10 (Contestant 10) | $142,500 | $145,000 | +2,500 (+1.8%) |
| c23 (Contestant 23) | $202,500 | $205,000 | +2,500 (+1.2%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | -25.0 | 536.0 | — | c02 |
| value | replace | -50.0 | 558.0 | c02 → c12 ($115,000 freed, 1 viable, add penalty -10) | c02 |
| mid_tier | fixed | 10.0 | 565.0 | — | c10 |
| mid_tier | replace | -1.0 | 606.0 | c02 → c12 ($115,000 freed, 1 viable, add penalty -10) | c10 |
| random | fixed | 18.0 | 433.0 | — | c15 |
| random | replace | 7.0 | 507.0 | c02 → c12 ($115,000 freed, 1 viable, add penalty -10) | c15 |

---

### Episode 19 (post_merge)

**Voted out:** c08 (Contestant 08)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c08 (Contestant 08) | $140,000 | $135,000 | -5,000 (-3.6%) |
| c12 (Contestant 12) | $107,500 | $110,000 | +2,500 (+2.3%) |
| c21 (Contestant 21) | $247,500 | $250,000 | +2,500 (+1.0%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 20.0 | 556.0 | — | c12 |
| value | replace | 60.0 | 618.0 | — | c12 |
| mid_tier | fixed | 10.0 | 575.0 | — | c10 |
| mid_tier | replace | 30.0 | 636.0 | — | c10 |
| random | fixed | 15.0 | 448.0 | — | c15 |
| random | replace | 35.0 | 542.0 | — | c15 |

---

### Episode 20 (post_merge)

**Voted out:** c15 (Contestant 15)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c15 (Contestant 15) | $160,000 | $155,000 | -5,000 (-3.1%) |
| c10 (Contestant 10) | $145,000 | $147,500 | +2,500 (+1.7%) |
| c23 (Contestant 23) | $205,000 | $207,500 | +2,500 (+1.2%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | 10.0 | 566.0 | — | c12 |
| value | replace | 30.0 | 648.0 | — | c12 |
| mid_tier | fixed | 20.0 | 595.0 | — | c10 |
| mid_tier | replace | 30.0 | 666.0 | — | c10 |
| random | fixed | -26.0 | 422.0 | — | c15 |
| random | replace | -16.0 | 516.0 | c15 → c10 ($160,000 freed, 2 viable, add penalty -10) | c15 |

---

### Episode 21 (post_merge)

**Voted out:** c12 (Contestant 12)

**Price changes:**

| Contestant | Before | After | Change |
|------------|--------|-------|--------|
| c12 (Contestant 12) | $110,000 | $105,000 | -5,000 (-4.5%) |
| c10 (Contestant 10) | $147,500 | $150,000 | +2,500 (+1.7%) |
| c23 (Contestant 23) | $207,500 | $210,000 | +2,500 (+1.2%) |

**Fantasy team impact:**

| Team | Style | Episode Pts | Cumulative | Roster Change | Captain |
|------|-------|-------------|-----------|---------------|---------|
| value | fixed | -44.0 | 522.0 | — | c12 |
| value | replace | -132.0 | 516.0 | — | c12 |
| mid_tier | fixed | 20.0 | 615.0 | — | c10 |
| mid_tier | replace | -24.0 | 642.0 | — | c10 |
| random | fixed | 20.0 | 442.0 | — | c10 |
| random | replace | -4.0 | 512.0 | — | c10 |

---
