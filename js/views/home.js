// home.js — the "My Teams" screen.
// Later: one card per favorite team with its latest score and next game.

export function homeScreen(screen) {
  screen.innerHTML = `
    <div class="card">
      <p><strong>No favorite teams yet</strong></p>
      <p class="dim">Soon you'll pick your teams here and see their latest
      scores and next games at a glance.</p>
    </div>
  `;
}
