# DIDDY Demon List V2.8.0 — THE DIDDY UNIVERSE

## Major update
V2.8 turns the existing DIDDY Demon List into a connected ecosystem while preserving the V2.7 feature set.

### Added
- Enxy 2.0 intelligence layer
- Unified event stream derived from existing records, placement history, and changelog data
- DIDDY Universe 2.0 ecosystem overview
- Time Machine 3.0 date-based placement reconstruction
- Analytics 2.0 metrics and activity panels
- Player Battles 2.0 head-to-head matrix
- Achievement milestone codex
- Enxy News Engine
- Hall of Fame career milestones
- DIDDY Map player ↔ level relationship graph
- V2.8 homepage ecosystem hub
- V2.8 release notes and cache-busted assets

## Database
No new Supabase tables, columns, RPCs, or migrations are required by V2.8. The new systems read existing public tables:
`levels`, `players`, `records`, `placement_history`, `point_values`, and `changelog`.

## Safety / preservation
- `config.js` is intentionally not included.
- Existing V2.7 files and features are preserved.
- Seasons remain excluded.
- The new analytics are descriptive and derived from existing records; they do not overwrite database data.

## Verification checklist
- [x] V2.8 release note added at the top of `release-notes.js`
- [x] Older release notes preserved
- [x] Asset cache versions bumped to 2.8.0 on updated pages
- [x] Existing JS files retained
- [x] Existing SQL files retained
- [x] `config.js` not overwritten/included
- [x] Seasons-excluded behavior preserved
- [x] No new Supabase migration required
