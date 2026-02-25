# Survivor Fantasy Point Simulation Report

## Simulation Parameters

- **Total team-scenario pairs:** 50,000
- **Average team score:** 406.3
- **Total points across all runs:** 20,317,357

### Important: No Player Replacement

This simulation uses **fixed rosters with no replacement**. Each team selects 7 contestants at the start (pre-merge). When a contestant is voted out, they are **not replaced**—the same 7 players are scored for the entire season. Eliminated players stop earning points (no survival, challenges, or tribal) but can still incur penalties (voted out). There is no merge repick in this simulation.


## How the Simulation Works

This section explains the exact rules of each simulated game so you can verify the simulation is correct.

### Overview

- **Monte Carlo simulation:** Each "run" generates one random season scenario. The same set of team rosters is then scored against that scenario. Total team-scenario pairs = (scenario runs) × (rosters per run) × (strategies).
- **One scenario = one full season:** Boot order, challenge winners, idol finds/plays, etc. are determined once per scenario and stay fixed for all teams.
- **One roster = one team:** Each team has a fixed 7-contestant roster. The same roster is scored against every scenario.

---

### Roster Rules (Team Construction)

| Rule | Implementation |
|------|-----------------|
| **Roster size** | 7 contestants |
| **Tribe constraint** | 2 contestants from each of 3 starting tribes (Tribe A, B, C) |
| **Wild card** | 1 additional contestant from any tribe |
| **No replacement** | When a roster member is voted out, they are NOT replaced. The same 7 players are used for the entire season. |
| **No merge repick** | There is no post-merge roster rebuild. The 7 pre-merge picks are the only picks. |

**Roster strategies tested:** `random`, `challenge_beast` (prioritize high challenge_ability), `idol_hunter` (prioritize high idol_likelihood), `utr` (prioritize high survival_bias), `balanced` (same as random).

---

### Contestant Pool

- **24 contestants** total
- **3 starting tribes:** Tribe A (1–8), Tribe B (9–16), Tribe C (17–24)
- **Each contestant has traits:** `challenge_ability`, `idol_likelihood`, `survival_bias` (0–1 scale). These bias random outcomes.

---

### Season Structure (Dynamic)

| Phase | When | Tribes | Immunity | Reward |
|-------|------|--------|----------|--------|
| Pre-merge | Start until swap | 3 tribes | Team (3) | Team (3) |
| Swap | 16 or 17 players left (50% each) | 2 tribes (random) | Team (2) | Team (2) |
| Merge | 12 or 11 players left (50% each) | 1 tribe | Individual | Individual |
| Finale | 3 remain | — | — | No (FTC only) |

- **Tribe swap:** After 7 or 8 eliminations (50% chance each), remaining players are randomly split into 2 tribes.
- **Full merge:** After 4–6 more eliminations (depending on swap point), all remaining players merge into 1 tribe.
- **Total eliminations:** 21 (24 → 3). Episode count varies by swap/merge timing.

---

### Scenario Generation Rules (Per Season)

#### Boot Order
- **Determined once per scenario** using weighted random: each contestant's `survival_bias` (0–1) is their weight.
- **Order is fixed:** First in boot order = episode 1 vote-out, etc. 21 eliminations total (24 → 3).

#### Team Immunity
- **3 tribes (pre-merge):** 1st = +3, 2nd = +1, 3rd = -1
- **2 tribes (swap phase):** 1st = +3, 2nd = +0

#### Team Reward
- **3 tribes:** 1st = +2, 2nd = +1, 3rd = 0
- **2 tribes:** 1st = +2, 2nd = +0

#### Individual Immunity (Post-merge)
- **One winner per episode.** Weighted random using `challenge_ability`. **Winner gets +5.**

#### Vote Matched
- When someone is voted out, a random **65–95%** of the remaining (non-eliminated) players are designated as having voted for that person (on the "right side" of the vote).
- Each of those players gets +2.

#### Voted Out
- **Base penalty:** -4
- **Pocket multiplier:** If the voted-out player had an idol/advantage in pocket, penalty = -4 × 2^(number of items). 1 item = -8, 2 items = -16.
- **Per-vote penalty:** -1 × (votes received). Votes received: random 4–6 pre-merge, 5–9 post-merge.
- **Total:** -4 × 2^pocket + (-1 × votes)

#### Idol Finds
- **3–6 idols found per season** (random, more variability)
- **Random episodes** (from episodes with tribals)
- **Random finders** (contestants who find them)

#### Idol Plays (Success + Failure)
- **Each idol find** can be played at a later tribal. **~55% success rate** per play.
- **Success:** +7 points. **Failure** (played incorrectly): **-2 points**.
- **Must occur after the find.** Only counted when there is a tribal that episode.

#### Clue Reads
- **1–4 clue-read events per season**
- **1–2 readers per clue** (can be shared)
- **Random episodes, random readers**

#### Advantage Plays (non-idol)
- **0–2 successful plays per season**
- **Random episode, random player**

#### Strategic Player of the Episode (+4)
- **Replaces fake idol trick.** Each tribal where someone is voted out, one person from the `vote_matched` list is designated the **strategic driver** (the person who led the vote).
- **Selection:** Random choice **weighted by `survival_bias`** (higher = more likely to be chosen).
- **Points:** +4 to that player.

#### Voted Out with Idol in Pocket
- **17% chance** when someone is voted out that they had 1+ items in pocket
- **3% chance** (given they have an item) that they had 2 items

#### Quit / Medevac
- **Not implemented** in current simulation (quit probability ~0.02, medevac ~0.05—too rare to appear in 100 runs).

---

### Point Values (from config/scoring.yaml)

| Event | Points |
|-------|--------|
| Survival (pre-merge, swap) | +2 |
| Survival (post-merge) | +3 |
| Team immunity 1st | +3 |
| Team immunity 2nd (3 tribes) | +1 |
| Team immunity 2nd (2 tribes) | +0 |
| Team immunity 3rd/last | -1 |
| Team reward 1st | +2 |
| Team reward 2nd (3 tribes) | +1 |
| Team reward 2nd (2 tribes) | +0 |
| Individual immunity | +5 |
| Vote matched | +2 |
| Voted out (base) | -4 |
| Voted out (per vote) | -1 × votes |
| Voted out (pocket) | base × 2^items |
| Clue read | +1 |
| Advantage play | +4 |
| Idol play (success) | +7 |
| Idol play (failure) | -2 |
| Strategic player of episode | +4 |
| Final tribal (top 3) | +5 |
| Win season | +9 |
| Quit | -10 |

---

### Scoring Logic (How Points Are Assigned to a Team)

For each team roster and each episode:

1. **Only roster members still in the game** earn positive points (survival, challenges, vote matched, advantages). Eliminated roster members earn nothing from that point on.
2. **Voted out:** If a roster member is voted out this episode, the penalty is applied: `-4 × 2^pocket_items + (-1 × votes_received)`.
3. **Survival:** Each roster member in `survived` (attended tribal and was not voted out) gets +2 (pre-merge) or +3 (post-merge). Survival is only awarded when a tribal occurred and someone was voted out.
4. **Challenges:** Each roster member on the winning/losing tribe gets the corresponding team immunity/reward points. Individual immunity winner gets +5.
5. **Vote matched:** Each roster member in the `vote_matched` list gets +2.
6. **Advantages:** Clue readers (+1), idol players (+7), advantage players (+4), fake idol trickers (+4).
7. **Placement:** At finale, roster members in final 3 get +5 each; winner gets +9.

---

### What to Verify

- **Eliminations:** 13 tribals with votes (episodes 1–13). 18 − 13 = 5 remain at episode 14. Final three is randomly chosen from those 5; winner from those 3.
- **Survival:** Pre-merge (1–9): +2 per survivor per tribal. Post-merge (10–13): +3 per survivor. Max pre-merge survival for one player: 9 × 2 = 18. Max post-merge: 4 × 3 = 12.
- **Team challenges:** With 3 tribes, each tribe gets exactly one placement (1st, 2nd, or 3rd) per pre-merge episode. Each roster member gets one team immunity and one team reward result per pre-merge episode.
- **Individual immunity:** Exactly one winner per post-merge episode (10–13).


---

## Every Point Feature: Count, Avg per Team, Total Points, % of Total

| Event Type | Total Occurrences | Avg per Team | Total Points | % of All Points |
|------------|-------------------|--------------|--------------|-----------------|
| Survival (pre-merge, +2 per episode) | 2,127,828 | 42.6 | 4,255,656 | 20.95% |
| Survival (post-merge, +3 per episode) | 788,829 | 15.8 | 2,366,487 | 11.65% |
| Survival (swap phase, +2 per episode) | 945,517 | 18.9 | 1,891,034 | 9.31% |
| Team immunity 1st place (+3) | 1,256,011 | 25.1 | 3,768,033 | 18.55% |
| Team immunity 2nd place, 3-team (+1) | 747,737 | 15.0 | 747,737 | 3.68% |
| Team immunity 2nd place, 2-team (+0) | 512,980 | 10.3 | 0 | 0.00% |
| Team immunity 3rd/last (-1) | 747,105 | 14.9 | -747,105 | -3.68% |
| Team reward 1st place (+2) | 1,254,942 | 25.1 | 2,509,884 | 12.35% |
| Team reward 2nd place, 3-team (+1) | 749,523 | 15.0 | 749,523 | 3.69% |
| Team reward 2nd place, 2-team (+0) | 512,689 | 10.3 | 0 | 0.00% |
| Individual immunity win (+5) | 122,648 | 2.5 | 613,240 | 3.02% |
| Vote matched person voted out (+2) | 2,937,217 | 58.7 | 5,874,434 | 28.91% |
| Voted out (base -4 × 2^pocket + -1 per vote) | 309,232 | 6.2 | -3,408,482 | -16.78% |
| First to read clue (+1) | 53,128 | 1.1 | 53,128 | 0.26% |
| Successful advantage play (+4) | 7,033 | 0.1 | 28,132 | 0.14% |
| Successful immunity idol play (+7) | 10,398 | 0.2 | 72,786 | 0.36% |
| Idol played incorrectly (-2) | 9,265 | 0.2 | -18,530 | -0.09% |
| Strategic player of episode (+4) | 308,466 | 6.2 | 1,233,864 | 6.07% |
| Reach final tribal (+5) | 40,768 | 0.8 | 203,840 | 1.00% |
| Win season (+9) | 13,744 | 0.3 | 123,696 | 0.61% |
| Quit (-10) | 0 | 0.0 | 0 | 0.00% |

---

## Example Team Breakdowns

Three sample team-scenario results showing how points break down by event type.

### Example: Lowest Scoring Team (Total: 94 points)

- **Strategy:** random
- **Scenario ID:** 130

| Event Type | Count | Points |
|------------|-------|--------|
| Survival (pre-merge, +2 per episode) | 26 | 52 |
| Survival (swap phase, +2 per episode) | 2 | 4 |
| Team immunity 1st place (+3) | 10 | 30 |
| Team immunity 2nd place, 3-team (+1) | 10 | 10 |
| Team immunity 2nd place, 2-team (+0) | 4 | 0 |
| Team immunity 3rd/last (-1) | 11 | -11 |
| Team reward 1st place (+2) | 13 | 26 |
| Team reward 2nd place, 3-team (+1) | 9 | 9 |
| Team reward 2nd place, 2-team (+0) | 1 | 0 |
| Vote matched person voted out (+2) | 21 | 42 |
| Voted out (base -4 × 2^pocket + -1 per vote) | 7 | -76 |
| Strategic player of episode (+4) | 2 | 8 |

### Example: Median Scoring Team (Total: 406 points)

- **Strategy:** random
- **Scenario ID:** 312

| Event Type | Count | Points |
|------------|-------|--------|
| Survival (pre-merge, +2 per episode) | 44 | 88 |
| Survival (post-merge, +3 per episode) | 13 | 39 |
| Survival (swap phase, +2 per episode) | 25 | 50 |
| Team immunity 1st place (+3) | 30 | 90 |
| Team immunity 2nd place, 3-team (+1) | 15 | 15 |
| Team immunity 2nd place, 2-team (+0) | 12 | 0 |
| Team immunity 3rd/last (-1) | 15 | -15 |
| Team reward 1st place (+2) | 28 | 56 |
| Team reward 2nd place, 3-team (+1) | 15 | 15 |
| Team reward 2nd place, 2-team (+0) | 15 | 0 |
| Individual immunity win (+5) | 1 | 5 |
| Vote matched person voted out (+2) | 65 | 130 |
| Voted out (base -4 × 2^pocket + -1 per vote) | 7 | -79 |
| Strategic player of episode (+4) | 3 | 12 |

### Example: Highest Scoring Team (Total: 771 points)

- **Strategy:** balanced
- **Scenario ID:** 302

| Event Type | Count | Points |
|------------|-------|--------|
| Survival (pre-merge, +2 per episode) | 56 | 112 |
| Survival (post-merge, +3 per episode) | 39 | 117 |
| Survival (swap phase, +2 per episode) | 34 | 68 |
| Team immunity 1st place (+3) | 35 | 105 |
| Team immunity 2nd place, 3-team (+1) | 20 | 20 |
| Team immunity 2nd place, 2-team (+0) | 16 | 0 |
| Team immunity 3rd/last (-1) | 20 | -20 |
| Team reward 1st place (+2) | 35 | 70 |
| Team reward 2nd place, 3-team (+1) | 19 | 19 |
| Team reward 2nd place, 2-team (+0) | 18 | 0 |
| Individual immunity win (+5) | 7 | 35 |
| Vote matched person voted out (+2) | 101 | 202 |
| Voted out (base -4 × 2^pocket + -1 per vote) | 4 | -48 |
| Successful advantage play (+4) | 1 | 4 |
| Successful immunity idol play (+7) | 1 | 7 |
| Strategic player of episode (+4) | 14 | 56 |
| Reach final tribal (+5) | 3 | 15 |
| Win season (+9) | 1 | 9 |

---

## Category Summary

| Category | Avg Points | % of Total |
|----------|------------|------------|
| survival | 170.3 | 41.9% |
| challenges | 152.8 | 37.6% |
| tribal | 117.5 | 28.9% |
| advantages | 27.8 | 6.8% |
| placement | 6.6 | 1.6% |
| penalties | -68.5 | -16.9% |

## Point Distribution (Percentiles)

| Percentile | Points |
|------------|--------|
| 10th | 273 |
| 25th | 335 |
| 50th (median) | 406 |
| 75th | 478 |
| 90th | 538 |

## Strategy Comparison

| Strategy | Avg Score | Min | Max | Count |
|----------|-----------|-----|-----|-------|
| random | 421.6 | 94 | 771 | 10,000 |
| challenge_beast | 370.8 | 99 | 666 | 10,000 |
| idol_hunter | 441.3 | 187 | 707 | 10,000 |
| utr | 376.4 | 99 | 704 | 10,000 |
| balanced | 421.6 | 94 | 771 | 10,000 |

## Balance Notes

- **Survival:** 41.9% of points. Core floor.
- **Challenges:** 37.6% of points. Team + individual immunity/reward.
- **Penalties:** Avg -68.5 per team. Voted-out penalty creates downside.
- **Advantages:** 6.8% of points. Idol/advantage events are rare by design.