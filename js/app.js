// app.js — the starting point of the app's code.
// Its main job: watch the address and show the matching screen.
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
import { setTitle } from "./ui.js";

// A lookup table: screen name -> its title and the function that draws it.
// Screens with no title here set their own (e.g. a team's name).
// Only the first four are tabs in the bottom bar.
const screens = {
  home:      { title: "My Teams",       draw: homeScreen },
  scores:    { title: "Scores",         draw: scoresScreen },
  leagues:   { title: "Leagues",        draw: leaguesScreen },
  settings:  { title: "Settings",       draw: settingsScreen },
  favorites: { title: "Favorite Teams", draw: favoritesScreen },
  league:    { title: "",               draw: leagueScreen },
  team:      { title: "",               draw: teamScreen },
};

const TABS = ["home", "scores", "leagues", "settings"];

function showCurrentScreen() {
  // "#team/nfl/8" -> name "team", details ["nfl", "8"]
  let [name, ...details] = location.hash.slice(1).split("/");
  if (!screens[name]) name = "home";   // first launch or unknown address

  setTitle(screens[name].title);
  screens[name].draw(document.getElementById("screen"), ...details);

  // Highlight the selected tab. Pages that aren't tabs (like a team page)
  // leave the highlight on the tab you came from.
  if (TABS.includes(name)) {
    for (const link of document.querySelectorAll(".tab-bar a")) {
      link.classList.toggle("active", link.dataset.tab === name);
    }
  }

  // Start each screen at the top
  window.scrollTo(0, 0);
}

// Run once when the app opens, then again every time the address changes
showCurrentScreen();
window.addEventListener("hashchange", showCurrentScreen);
