// app.js — the starting point of the app's code.
// Its main job: watch which tab is selected and show the matching screen.

// Each screen lives in its own file in js/views/.
// "import" pulls in the function each file shares with us.
import { homeScreen } from "./views/home.js";
import { scoresScreen } from "./views/scores.js";
import { leaguesScreen } from "./views/leagues.js";
import { settingsScreen } from "./views/settings.js";
import { favoritesScreen } from "./views/favorites.js";

// A lookup table: screen name -> its title and the function that draws it.
// "favorites" isn't a tab; you reach it from Home or Settings.
const screens = {
  home:      { title: "My Teams",       draw: homeScreen },
  scores:    { title: "Scores",         draw: scoresScreen },
  leagues:   { title: "Leagues",        draw: leaguesScreen },
  settings:  { title: "Settings",       draw: settingsScreen },
  favorites: { title: "Favorite Teams", draw: favoritesScreen },
};

function showCurrentTab() {
  // The address ends in e.g. "#scores". Take the part after "#".
  // If there's nothing there (first launch), start on "home".
  let tab = location.hash.slice(1);
  if (!screens[tab]) tab = "home";

  // Change the big title and fill the screen area
  document.getElementById("title").textContent = screens[tab].title;
  screens[tab].draw(document.getElementById("screen"));

  // Highlight the selected tab in the bottom bar
  for (const link of document.querySelectorAll(".tab-bar a")) {
    link.classList.toggle("active", link.dataset.tab === tab);
  }

  // Start each screen at the top
  window.scrollTo(0, 0);
}

// Run once when the app opens, then again every time a tab is tapped
showCurrentTab();
window.addEventListener("hashchange", showCurrentTab);
