---
name: survivor-50-research-agent
description: Research all 24 Survivor 50 contestants and assign FIFA-style 0-100 scores for physicality, cognition, strategy, influence, and resilience. Output is written to scripts/data/contestant_trait_scores.json for use by the apply script.
---

# Survivor 50 Contestant Research Agent

## When to use

Apply this skill when the user asks to:
- Research Survivor 50 contestants and score them
- Run the Survivor 50 research agent
- Score all Survivor 50 cast members on physicality, cognition, strategy, influence, and resilience
- Produce trait scores for the survivor_fantasy app contestants

## Canonical contestant list (Survivor 50)

You must research and score exactly these 24 contestants. IDs are required for the output JSON.

| ID   | Name |
|------|------|
| c01  | Rick Devens |
| c02  | Cirie Fields |
| c03  | Emily Flippen |
| c04  | Christian Hubicki |
| c05  | Joe Hunter |
| c06  | Jenna Lewis-Dougherty |
| c07  | Savannah Louie |
| c08  | Ozzy Lusth |
| c09  | Charlie Davis |
| c10  | Tiffany Ervin |
| c11  | Chrissy Hofbeck |
| c12  | Kamilla Karthigesu |
| c13  | Dee Valladares |
| c14  | Coach Wade |
| c15  | Mike White |
| c16  | Jonathan Young |
| c17  | Aubry Bracco |
| c18  | Q Burdette |
| c19  | Colby Donaldson |
| c20  | Kyle Fraser |
| c21  | Angelina Keeley |
| c22  | Stephenie LaGrossa Kendrick |
| c23  | Genevieve Mushaluk |
| c24  | Rizo Velovic |

## Stat definitions (FIFA-style 0–100)

Score each contestant on these five traits. Use integers only, between **1 and 100** (inclusive). The database rejects 0; use 1 for the lowest tier.

- **Physicality**: Strength, speed, balance, coordination. Challenge performance in physical tasks (carrying, swimming, obstacle courses). 1 = very low, 100 = elite.
- **Cognition**: Puzzle and mental challenge ability. Logic, pattern recognition, memory, spatial reasoning. Based on past puzzle/challenge showings and described strengths.
- **Strategy**: Reading the game, voting blocks, timing of moves, advantage/idol use, endgame planning. Not just “played before”—quality and execution of strategic play.
- **Influence**: Social sway, building alliances, persuasion, jury management, likeability. Ability to get others to act in their interest or spare them.
- **Resilience**: Endurance, handling hunger/cold/setbacks, recovery from twists and blindsides, mental toughness. Lasting through hardship without quitting or breaking down.

Be consistent across contestants: use the full 1–100 scale so that elite players in a category reach the 80s–90s and weak showings sit in the 20s–40s as appropriate.

## Research instructions

1. Use web search and reputable sources: Survivor Wiki, EW, People, entertainment news, and official/cast announcements.
2. For each contestant, consider: past seasons played, challenge wins/failures, notable strategic and social moments, placement, confessionals and edit, any post-show or pre-S50 commentary.
3. Score all 24 contestants. Do not skip anyone. If information is sparse (e.g. new or lesser-known returnees), use reasonable inference from their known season(s) and comparable players.
4. You may include a brief rationale per contestant (e.g. in a separate section or minimal inline) to document reasoning; the primary deliverable is the JSON file.

## Output format

Write a single JSON file to this path (relative to the survivor_fantasy project root):

**Path:** `scripts/data/contestant_trait_scores.json`

**Structure:** Object keyed by contestant id (`c01` through `c24`). Each value is an object with exactly these keys, all integers from 1 to 100:

```json
{
  "c01": {
    "physicality": 72,
    "cognition": 68,
    "strategy": 78,
    "influence": 75,
    "resilience": 70
  },
  "c02": { ... },
  ...
  "c24": { ... }
}
```

- Keys must be contestant ids: `c01`, `c02`, … `c24` (exactly 24 entries).
- Each entry must have: `physicality`, `cognition`, `strategy`, `influence`, `resilience`.
- All values must be integers in the range 1–100.

The apply script reads this file and updates the `contestants` table in Supabase. Do not use `endurance`; the app stores this dimension as `resilience`.

## Steps to perform

1. Ensure the directory `scripts/data` exists (create it if not).
2. Research each of the 24 contestants using web search and the stat definitions above.
3. Assign scores for all five traits per contestant; keep the scale consistent.
4. Write the result to `scripts/data/contestant_trait_scores.json` in the format specified.
5. Optionally summarize high/low scores or rationale in the chat; the JSON file is the canonical output.

After the file is written, the user can run the apply script to push scores to the database: from the project root, `node scripts/apply-contestant-scores.mjs` (with env from `app/.env.local`).
