// scores.js — the "Scores" screen.
// Later: a strip of dates to swipe through, and every game on the chosen day.

export function scoresScreen(screen) {
  screen.innerHTML = `
    <div class="card">
      <p><strong>Scores by date</strong></p>
      <p class="dim">Games for each day will appear here, grouped by league,
      with your favorite teams first.</p>
    </div>
  `;
}
