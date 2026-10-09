// espn.js — everything that talks to ESPN lives in this one file.
// If ESPN ever changes, this is the only file we should need to fix.

const BASE = "https://site.api.espn.com/apis/site/v2/sports";

// ESPN's logos are big (500×500). This asks ESPN's image service for a
// small copy instead (about 8× less to download), so lists load quickly.
export function smallLogo(url, size = 96) {
  const path = url.replace("https://a.espncdn.com", "");
  if (path === url) return url;   // not an ESPN image: leave it alone
  return `https://a.espncdn.com/combiner/i?img=${path}&w=${size}&h=${size}`;
}

// Team lists come from teams.json, a file saved inside the app by
// tools/update_teams.py. (ESPN doesn't let web pages download the full
// team list directly, and the lists rarely change anyway.)
let allTeams = null;

// Get every team in a league, sorted A–Z.
// Returns a list like: [{ id, name, abbr, color, logo }, ...]
export async function fetchTeams(league) {
  if (!allTeams) {
    const response = await fetch("js/data/teams.json");
    if (!response.ok) throw new Error(`teams.json returned ${response.status}`);
    allTeams = await response.json();
  }
  return allTeams[league.id] ?? [];
}
