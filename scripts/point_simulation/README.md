# Survivor Fantasy Point Simulation

Monte Carlo simulation agent for validating scoring balance.

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
python run_simulation.py --runs 200 --rosters 15 --output ../output/simulation
```

Options:
- `--runs`: Number of scenario runs (default: 500)
- `--rosters`: Rosters per strategy per run (default: 20)
- `--seed`: Random seed for reproducibility (default: 42)
- `--output`: Output directory for report and analysis JSON

## Output

- `report.md`: Markdown report with category contribution, strategy comparison, balance check
- `analysis.json`: Raw analysis data

## Config

- `config/scoring.yaml`: Point values (matches PRD)
- `config/season_template.yaml`: Episode structure
- `config/contestants_s50.yaml`: Contestant pool with traits (challenge_ability, idol_likelihood, survival_bias)
