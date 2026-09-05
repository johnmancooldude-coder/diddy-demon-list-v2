# DIDDY DEMON LIST V19 — RELIABILITY PASS

V19 is the final maintenance/reliability update before the major 2.0 era.

## What changed
- Bumped site cache-busting to V19 so updated JS/CSS/pages are less likely to be hidden by stale browser/CDN caches.
- Added **System Check** (`health.html`) for admins.
- System Check verifies Supabase configuration, admin authorization, core tables, V18 reliability tables/views, and the latest-backup RPC.
- Diagnostics are read-only: the page does not insert, update, delete, move, or resequence anything.
- Existing V18/V18.5 features are preserved.
- No database migration is required for V19.
- The working `config.js` is intentionally not included or replaced.
- `config.example.js` is intentionally not included.
