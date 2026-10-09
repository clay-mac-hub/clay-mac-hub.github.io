// store.js — remembers your favorite teams on the phone.
// Uses "localStorage", a small storage box every browser gives each website.
// It survives closing the app and restarting the phone.

const KEY = "favorites";

// Read the saved list. Each favorite looks like:
// { league: "nfl", id: "22", name: "Arizona Cardinals", abbr: "ARI", color: "#a40227", logo: "https://..." }
export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return []; // storage unavailable or unreadable: start with no favorites
  }
}

function saveFavorites(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage unavailable (e.g. private browsing) — nothing we can do
  }
}

export function isFavorite(leagueId, teamId) {
  return getFavorites().some(f => f.league === leagueId && f.id === teamId);
}

// Add the team if it isn't a favorite yet, remove it if it is.
// Returns true if the team is now a favorite.
export function toggleFavorite(leagueId, team) {
  const list = getFavorites();
  const index = list.findIndex(f => f.league === leagueId && f.id === team.id);

  if (index >= 0) {
    list.splice(index, 1);   // remove it
  } else {
    list.push({ league: leagueId, id: team.id, name: team.name,
                abbr: team.abbr, color: team.color, logo: team.logo });
  }

  saveFavorites(list);
  return index < 0;
}
