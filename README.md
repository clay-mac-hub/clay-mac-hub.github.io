# Volleyball data (automatic)

This branch holds NCAA women's volleyball stats for the CMac Sports app. It's
written automatically every 30 minutes during the season by the GitHub job in
`.github/workflows/volleyball.yml` (on the `main` branch), which runs
`tools/update_volleyball.py`. Don't edit these files by hand.

- `games/<ESPN match id>.json` — one match's box score
- `teams/<ESPN team id>.json` — a team's season totals and players
- `index.json` — when it last ran
- `ncaa/` — the NCAA box scores the totals are built from
