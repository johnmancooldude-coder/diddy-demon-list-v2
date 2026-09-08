# DIDDY DEMON LIST V2.2 — THE DYNASTY UPDATE

## Foundation build
- Fixed the Players page rendering crash caused by undefined `formScore` / `title` variables.
- Restored working Form Score and Player Title badges on player cards.
- Added an explicit V2.2 release entry to the live Changelog fallback.
- Bumped HTML cache references to `v2.2`.

## Preservation rules
- Built from V2.11.
- Existing pages/features are preserved.
- No Supabase schema changes.
- No `config.js` overwrite.
- No `config.example.js`.

This is the first foundation step of V2.2; larger features should be added incrementally and validated between steps.


## V2.2.2 bugfix
Fixed the homepage Diddy Daily Briefing render call and bumped the homepage app.js cache version to prevent stale browser JavaScript.


## V2.2.3 — THE QUALITY UPDATE
- Daily Briefing now gives a real last-24-hours summary.
- Added quiet-day messaging, biggest movement, and most-active-player callouts.
- Cache-busted homepage scripts to 2.2.3.
- No database schema changes.
- Existing config.js is not included or overwritten.
