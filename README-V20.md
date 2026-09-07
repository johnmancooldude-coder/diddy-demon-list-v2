# DIDDY DEMON LIST 2.0 — ULTIMATE

Built directly from V19.23. This release keeps existing pages/features and adds the 2.0 command-center experience.

## Major areas
- Homepage 3.0 command center
- Player Profile 5.0 analytics + DNA
- Level Page 4.0 history + victor analytics
- Record Book 3.0
- Time Machine 3.0
- Player Battles 4.0
- Search 3.0 smart queries
- Achievements 2.0
- Admin 2.0 navigation/command center
- Visual/mobile polish

## Supabase
No new V20 tables are required. Existing V17/V18/V19 schema objects are reused. Keep the real `config.js` already in your repository. This build intentionally does not include `config.example.js`.

- 2.0.2 homepage recency accuracy: climbers/falls use 24h movement, trending uses 3d victories, rising players compare last 3d vs previous 3d, and recent victories use 24h.


## V2.0.3
- Added reliable rank movement history for every level displaced by a move or insertion.
- Added ▲/▼ 24-hour movement badges to level rows.
- Added V2.0.3 release notes to the Changelog page.
- No config.js is included or overwritten.
- SQL patch: v2_0_3_ranking_history.sql


## V2.0.4
- Player Form SURGING threshold increased to 6+ wins in the last 24 hours with acceleration.
