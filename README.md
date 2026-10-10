# CMac Sports

A personal sports app for iPhone: live scores, schedules, standings and team
pages for the NFL, NBA, MLB, NHL, college football and basketball, the Premier
League, the Champions League, and PGA/LPGA golf leaderboards.

It's a **home-screen web app**: a web page that, added to the iPhone Home
Screen from Safari, opens full-screen like a regular app. It needs no Apple
developer account and never expires.

Data comes from ESPN's public (but undocumented) feeds, for personal use. If
ESPN changes something and the app stops loading, the fix belongs in
`js/data/espn.js`.

## Preview on the Mac

From this folder, start a small local web server:

```
python3 -m http.server 8080
```

Then open http://localhost:8080 in a browser. Stop it with Ctrl-C.

## Occasional chores

- **Update team lists** (new Premier League teams after promotion, new
  Champions League clubs each season):
  `python3 tools/update_teams.py`
- **Change the app icon:** edit `icons/icon.svg`, then run
  `sh tools/make_icons.sh`

## Where things are

| File | What it does |
|---|---|
| `index.html` | The page: title bar, tab bar, app icon links |
| `styles.css` | All the colors, sizes and layout (light and dark mode) |
| `js/app.js` | Shows the right screen for the address; refreshing |
| `js/views/` | One file per screen (home, scores, leagues, team, golf…) |
| `js/data/leagues.js` | The leagues, and how their standings are shown |
| `js/data/espn.js` | Everything that downloads data from ESPN |
| `js/data/teams.json` | Saved team lists (made by `tools/update_teams.py`) |
| `js/store.js` | Remembers favorite teams and settings on the phone |
