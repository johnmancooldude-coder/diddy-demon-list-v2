# DIDDY DEMON LIST V16 — ADMIN ORDER + INSERTION FIX

## What changed
- Admin Levels panel displays Main first, then Extended, then Legacy.
- Main is #1-#45.
- Extended starts at #46.
- Legacy starts at #101.
- Adding a level at a chosen Main rank inserts it there and pushes lower levels down.
- Main overflow automatically moves into Extended.
- Adding a level at a chosen Extended rank inserts it at that rank and pushes lower Extended levels down.
- Existing config.js is preserved.

## SQL
The V16 SQL file is `v16_auto_sections.sql`.
If you already ran the V15.1 SQL successfully, run this V16 SQL once to replace the create/move functions with the V16 insertion logic.
