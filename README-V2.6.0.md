# DIDDY DEMON LIST — V2.6.0 THE DIDDY WORLD UPDATE

V2.6 expands DIDDY from player intelligence into a world-level intelligence/history platform.

## Added
- Diddy Universe 3.0 live world dashboard
- Player Statistics 3.0 and deeper career metrics on player profiles
- Rank History 3.0 with recorded rank journey
- Achievement System 3.0 / Achievement Codex
- Player Battles 5.0 composite matchup and verdict
- Diddy History 2.0 searchable event archive inside Time Machine
- Diddy News 4.0 automated major-event feed
- Dedicated #1 History page
- Search 3.0 universal search across players, levels, victories, news, achievements, and history
- Admin 3.0 control-room navigation and safer Repair Rankings confirmation

## Safety / preservation
- No Seasons added.
- No ranking engine replacement.
- No new Supabase SQL migration is required.
- Existing V2.5/V2.5.1 systems remain in the source tree.
- config.js is intentionally not bundled or overwritten.
- Player win-rate is explicitly marked unavailable because failed attempts are not stored in the database.
- #1 History uses placement_history and labels inferred victory context conservatively; it does not invent a direct "beaten by" relationship when the database cannot prove it.

## Deployment
Upload the individual files to the existing GitHub Pages repository. Keep the existing config.js already in the repository. If GitHub's uploader requires multiple commits, allow the Pages deployment to finish before making another update.
