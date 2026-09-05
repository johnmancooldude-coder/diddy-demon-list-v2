# DIDDY DEMON LIST V15.1 — AUTO LIST BOUNDARY FIXED

## New in V15
- Main List is automatically capped at #45.
- If a Main List level is pushed to #46 or lower, it automatically moves to the Extended List.
- Extended List numbering starts at **#46**, never #1.
- Extended levels continue #46, #47, #48, etc.
- Legacy continues from #101.
- Adding or moving a level uses the same automatic boundary rules.
- Placement history records automatic Main → Extended changes.

## Supabase setup
Run `v15_auto_sections.sql` once in Supabase SQL Editor after your existing V14/V14 fix SQL.

## IMPORTANT
Keep your working `config.js`. Do not replace it with the blank template in this ZIP.

## Example
If Main is:
- #44 Level A
- #45 Level B

and you insert a new level at #45:
- #44 Level A
- #45 New Level
- Extended #46 Level B

The Extended list will display #46, #47, #48... rather than restarting at #1.
