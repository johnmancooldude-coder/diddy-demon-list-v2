V2.4.1 — RANKING INTEGRITY FIX

Fixes rank gaps after deleting levels by using the admin-protected v24_delete_level function, which resequences Main, Extended, and Legacy and records affected placement changes. Prevents accidental duplicate level creation from repeated level-form submissions in the admin UI.

Run v2_4_1_ranking_integrity.sql once in Supabase before using the deletion fix. No new tables are required.
