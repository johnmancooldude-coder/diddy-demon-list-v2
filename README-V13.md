# DIDDY DEMON LIST V13 — LEGENDS

**The list remembers.**

V13 is the Hall of Fame / records / history update built on the V12 Atomic foundation.

## What changed

- Hall of Fame 2.0 with automatic legends, hardest victories, climbers, falls, longest #1 reigns, and global records.
- Curated Hall museum exhibits editable by admins.
- Hall Time Machine: reconstruct recorded list snapshots by date.
- Daily Challenge card (fun/unofficial; does not award official points).
- Player Power 2.0 profile with peak, consistency, Top 10/25, depth, XP, momentum, and trophy case.
- Player Battle mode with Power-based winner and victory matchup.
- Achievement rarity plus secret achievement vault.
- Global record book for first victory, hardest victory, fewest attempts, and fastest completion when those optional record fields exist.
- Rank-change animation and recent movement arrows on the main list.
- Player momentum badges (SURGING / ACTIVE / QUIET).
- Admin Hall curator.
- Optional victory attempts + completion time fields.
- V13 cache busting across pages.
- Responsive/mobile Hall, trophy, power, and battle layouts.

## Supabase setup

Run **`v13_schema_patch.sql` once** in a new Supabase SQL Editor query **after V12**.

It adds:
- `records.attempts`
- `records.completion_seconds`
- `hall_entries`
- RLS/grants for public Hall viewing and admin Hall editing

Do **not** replace your working `config.js` with the blank template from this ZIP. Keep your existing Supabase URL and publishable/anon key.

## Notes

- Official level points still come from `point_values` and victories remain the source of player points.
- Power, XP, Heat, momentum, community votes, and Daily Challenge are unofficial discovery/progression systems.
- Time Machine quality depends on how much placement history has been recorded. V10+ placement-history improvements make future snapshots increasingly complete.
- Attempts and completion time are optional. Existing records remain valid without them.
