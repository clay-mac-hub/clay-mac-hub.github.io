"""
update_teams.py — downloads every league's team list from ESPN and saves it
into js/data/teams.json, which the favorites picker reads.

Why: ESPN's team-list address doesn't allow web pages to read it directly,
but a script on your Mac can. Team lists rarely change, so run this about
once a season (e.g. when Premier League promotions or a new Champions League
season happen):

    python3 tools/update_teams.py
"""

import json
import pathlib
import urllib.request

BASE = "https://site.api.espn.com/apis/site/v2/sports"

# Same ids and paths as js/data/leagues.js (golf has no teams)
LEAGUES = {
    "nfl": "football/nfl",
    "nba": "basketball/nba",
    "mlb": "baseball/mlb",
    "nhl": "hockey/nhl",
    "cfb": "football/college-football",
    "cbb": "basketball/mens-college-basketball",
    "epl": "soccer/eng.1",
    "ucl": "soccer/uefa.champions",
}

OUT = pathlib.Path(__file__).resolve().parent.parent / "js" / "data" / "teams.json"


def fetch_teams(path):
    with urllib.request.urlopen(f"{BASE}/{path}/teams?limit=1000") as response:
        data = json.load(response)
    teams = []
    for entry in data["sports"][0]["leagues"][0]["teams"]:
        team = entry["team"]
        logos = team.get("logos") or [{}]
        teams.append({
            "id": team["id"],
            "name": team["displayName"],
            "abbr": team.get("abbreviation", ""),
            "color": "#" + team["color"] if team.get("color") else "#888888",
            "logo": logos[0].get("href", ""),
        })
    return sorted(teams, key=lambda t: t["name"])


all_teams = {}
for league_id, path in LEAGUES.items():
    all_teams[league_id] = fetch_teams(path)
    print(f"{league_id}: {len(all_teams[league_id])} teams")

OUT.write_text(json.dumps(all_teams, separators=(",", ":")))
print(f"Saved {OUT}")
