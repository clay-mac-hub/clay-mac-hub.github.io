// leagues.js — the "Leagues" screen.
// Later: tap a league to see its standings and teams.

// The leagues (and golf tours) you follow, in the order they're listed
const leagues = ["NFL", "NBA", "MLB", "NHL", "College Football",
  "College Basketball", "Premier League", "Champions League",
  "PGA Tour", "LPGA Tour"];

export function leaguesScreen(screen) {
  // Turn each league name into one row of the list
  const rows = leagues.map(name => `<li>${name}</li>`).join("");
  screen.innerHTML = `<ul class="list">${rows}</ul>`;
}
