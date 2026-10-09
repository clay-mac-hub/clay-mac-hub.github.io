// format.js — small helpers that turn data into friendly text.

// "Sun, Oct 11 · 4:25 PM" (or "Sun, Oct 11 · Time TBD")
// Uses the iPhone's own time zone and 12/24-hour setting.
export function gameTime(game) {
  const day = game.date.toLocaleDateString(undefined,
    { weekday: "short", month: "short", day: "numeric" });
  if (!game.timeKnown) return `${day} · Time TBD`;
  const time = game.date.toLocaleTimeString(undefined,
    { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

// From one team's point of view: who they played and whether at home.
// Returns e.g. { prefix: "vs", opponent: {...}, us: {...} }
// ("vs" = home game, "@" = away game)
export function fromTeamView(game, teamId) {
  const home = game.home.id === teamId;
  return {
    prefix: home ? "vs" : "@",
    us: home ? game.home : game.away,
    opponent: home ? game.away : game.home,
  };
}
