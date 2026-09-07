# DIDDY DEMON LIST V19.23 — Minor Bug Fix Update

V19.23 is a reliability-focused pre-2.0 patch built from V19.2.

## Fixes
- Front-page Legends card now shows V19.23 instead of the stale V14 label.
- Front-page Top Player now reads from `player_leaderboard`, so it reflects actual calculated victory points instead of the `players` table.
- If the leaderboard view is temporarily unavailable, the homepage calculates a local fallback from current records + point values.
- Top Player name is clickable and opens that player's profile.
- Fixed the front-page Extended/Legacy selector label from `Legacy #100+` to `Legacy #101+`.
- Normalized cache-busting to V19.23 across pages so updated JS/CSS is less likely to be hidden by GitHub Pages/browser cache.
- Cleaned malformed old admin cache query strings.

## No database changes
V19.23 does not require a new Supabase SQL patch.

## Config safety
- Your real `config.js` is intentionally not included or overwritten.
- `config.example.js` is not included.
- Existing V18/V19/V19.2 SQL files are preserved for reference.
