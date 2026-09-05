# DIDDY DEMON LIST V12 — ATOMIC

V12 builds on the working V10/V11 frontend and adds:

- News & Activity Feed combining changelog, placement history, and victories
- Trending Levels / community heat score
- Community 1–5 level pulse voting (separate from official rank/points)
- Player Power ratings
- XP + player levels
- Expanded achievements and XP progression
- Advanced Player Analytics page
- Bulk admin level operations
- Admin News Desk for publishing announcements
- Rank-change entrance animation and V12 mobile refinements
- New navigation/dashboard discovery links

## Supabase
Run `v12_schema_patch.sql` once **after** the existing V10 schema patch. It adds the community voting tables/view. Existing `config.js` values must be preserved when copying files to GitHub.

## Important
Community votes are a fun public pulse, not an official difficulty/ranking signal. The anonymous voter key is browser-local and is not a security boundary against deliberate spam.
