# DIDDY DEMON LIST V2.3.3 — LIVE FEED CLEANUP

- Reduced the homepage Live Diddy Feed footprint.
- Added a stable release-notes source of truth in `release-notes.js`.
- The public Changelog now has two reliable sections: release history and live Supabase entries.
- For every future site update, add one new release object at the TOP of `release-notes.js`; do not delete older entries.
- Admin-published announcements continue to use the Supabase `changelog` table.
- No new Supabase tables or SQL are required.
- Keep the user's real `config.js`; this build intentionally does not include or overwrite it.
