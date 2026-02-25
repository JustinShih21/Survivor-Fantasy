# Strategic Player of the Episode Bonus (+4)

## Design

Replaces the "fake idol trick" with a quantifiable **Strategic Player of the Episode** bonus.

## How It Works

- **When:** Each episode where a tribal occurs and someone is voted out.
- **Who gets it:** One person from the `vote_matched` list (those on the "right side" of the vote).
- **Selection:** Random choice **weighted by `survival_bias`**—higher survival_bias = more likely to be chosen. This models the idea that the "strategic driver" is the one who read the room and organized the blindside.
- **Points:** +4 to that player.
- **Ties:** If multiple have same survival_bias, random among them.
- **Edge cases:** If only 1 person voted matched, they get it automatically. If no one voted out (no tribal), no bonus.

## Rationale

- **Quantifiable:** Uses existing vote_matched + survival_bias. No new random events.
- **Thematic:** Rewards being on the right side of the vote AND having "strategic" traits.
- **Variable:** Different person each episode; not dominated by one player.
- **Balanced:** +4 matches old fake idol trick value; ~1 per tribal = ~13 per season max.
