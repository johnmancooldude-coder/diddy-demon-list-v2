# DIDDY DEMON LIST V14 — OVERDRIVE

**Bigger. Faster. Smarter.**

## New in V14
- Admin victory records are paginated: only 10 records are loaded at once.
- Admin victory filters by player and level, with total-record counts and next/previous paging.
- Database indexes for records, placement history, changelog, levels, votes, and Hall entries.
- Fast `activity_feed`, `record_book`, and `level_victory_counts` views.
- Global Record Book page with hardest wins, fewest attempts, fastest completions, and newest victories.
- Diddy Universe explorer showing player ↔ level connections without loading the entire database.
- Historical Time Machine date-vs-date comparison.
- Bulk level section moves alongside difficulty/status/delete tools.
- Admin authentication gate with role check and sign-out.
- Mobile/performance polish, loading-friendly pagination controls, and V14 cache busting.
- Smart list search supports names plus quick queries like `#17` and `top 10`.
- Keeps V13 Hall of Fame, Power, trophies, achievements, trending, news, community votes, analytics, compare battles, daily challenge, backup/export, and placement history.

## Supabase setup
Run **`v14_schema_patch.sql` once after `v13_schema_patch.sql`** in Supabase SQL Editor.

Do not replace your working `config.js` with the blank template in this ZIP. Keep your current Supabase URL and publishable/anon key.

## Important scalability rule
The Admin Victory Records panel intentionally does **not** fetch the whole `records` table. It requests a 10-row page from Supabase and only fetches another page when the admin clicks Next.


### V14 Admin Auth Fix
If Admin says “Signed in, but this account is not an admin” even though the user is in `public.admins`, run `v14_admin_fix.sql` once. The updated admin.js verifies admin status through the protected `is_admin()` function and uses the admins table only for displaying the role.
