// app.js — the starting point of the app's code.
// Its main jobs: watch the address and show the matching screen, and
// refresh that screen when asked (or automatically during games).
//
// Addresses look like "#home", "#league/nfl" or "#team/nfl/8".
// The first part picks the screen; the rest is passed to it
// (e.g. which league, which team).

import { homeScreen } from "./views/home.js";
import { scoresScreen } from "./views/scores.js";
import { leaguesScreen } from "./views/leagues.js";
import { settingsScreen } from "./views/settings.js";
import { favoritesScreen } from "./views/favorites.js";
import { leagueScreen } from "./views/league.js";
import { teamScreen } from "./views/team.js";
import { orderScreen } from "./views/order.js";
import { golferScreen } from "./views/golfer.js";
import { gameScreen } from "./views/game.js";
import { playerScreen } from "./views/player.js";
import { setTitle, setRefreshing, hideUpdated } from "./ui.js";
import { clearScoreCache } from "./data/espn.js";
import { autoRefreshOn } from "./store.js";
import { enablePullToRefresh } from "./pull.js";

// A lookup table: screen name -> its title and the function that draws it.
// Screens with no title here set their own (e.g. a team's name).
// Only the first four are tabs in the bottom bar; "tab" says which tab a
// non-tab page belongs to (others keep the tab you came from).
const screens = {
  home:      { title: "Dashboard",      draw: homeScreen },
  scores:    { title: "Scores",         draw: scoresScreen },
  leagues:   { title: "Leagues",        draw: leaguesScreen },
  settings:  { title: "Settings",       draw: settingsScreen },
  favorites: { title: "Favorite Teams", draw: favoritesScreen },
  league:    { title: "",               draw: leagueScreen, tab: "leagues" },
  team:      { title: "",               draw: teamScreen },
  order:     { title: "League Order",   draw: orderScreen },
  golfer:    { title: "",               draw: golferScreen, tab: "leagues" },
  game:      { title: "",               draw: gameScreen },
  player:    { title: "",               draw: playerScreen },
};

const TABS = ["home", "scores", "leagues", "settings"];

// Draw the screen for the current address.
// refresh = true means "same screen, just get new scores": keep what's
// showing (and the scroll position) until the new scores arrive.
function showCurrentScreen(refresh = false) {
  // "#team/nfl/8" -> name "team", details ["nfl", "8"]
  let [name, ...details] = location.hash.slice(1).split("/");
  if (!screens[name]) name = "home";   // first launch or unknown address

  if (!refresh) {
    hideUpdated();   // the new screen shows it again once its scores load
    if (screens[name].title) setTitle(screens[name].title);
  }

  setRefreshing(refresh);
  const finished = screens[name].draw(document.getElementById("screen"), ...details);
  setRefreshing(false);

  // Highlight the selected tab. Pages that aren't tabs (like a team page)
  // leave the highlight on the tab you came from.
  const tab = TABS.includes(name) ? name : screens[name].tab;
  if (tab) {
    for (const link of document.querySelectorAll(".tab-bar a")) {
      link.classList.toggle("active", link.dataset.tab === tab);
    }
  }

  // A new screen starts at the top; a refresh stays where you were
  if (!refresh) window.scrollTo(0, 0);

  return finished;   // lets refresh() wait until the new scores are drawn
}

// ---------- Refreshing ----------

let lastRefresh = Date.now();
let inProgress = null;

// Get brand-new scores for the current screen
function refresh() {
  if (inProgress) return inProgress;   // already refreshing: don't double up
  clearScoreCache();
  inProgress = Promise.resolve(showCurrentScreen(true))
    .finally(() => { inProgress = null; lastRefresh = Date.now(); });
  return inProgress;
}

// Is there something on screen worth refreshing for? Either a live game,
// or a game whose start time has passed (it may have just kicked off).
function gameIsOn() {
  if (document.querySelector("#screen .badge.live")) return true;
  const now = Date.now();
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  return [...document.querySelectorAll("#screen [data-starts]")].some(el => {
    const starts = Number(el.dataset.starts);
    return starts <= now && now - starts < FOUR_HOURS;
  });
}

// Every 30 seconds: refresh if a game is on, auto-refresh is switched on,
// and the app is actually being looked at (not in the background).
setInterval(() => {
  if (!document.hidden && autoRefreshOn() && gameIsOn()) refresh();
}, 30_000);

// Coming back to the app after more than a minute away: refresh right away
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastRefresh > 60_000) refresh();
});

// Pull down, or tap "Updated 8:02 PM ↻", to refresh by hand
enablePullToRefresh(refresh);
document.getElementById("updated").addEventListener("click", refresh);

// ---------- Start ----------

// Run once when the app opens, then again every time the address changes
showCurrentScreen();
window.addEventListener("hashchange", () => showCurrentScreen());
