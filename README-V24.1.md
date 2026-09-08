V2.4.1 — RANKING INTEGRITY FIX

Fixes rank gaps after deleting levels by using the admin-protected v24_delete_level function, which resequences Main, Extended, and Legacy and records affected placement changes. Prevents accidental duplicate level creation from repeated level-form submissions in the admin UI.

Run v2_4_1_ranking_integrity.sql once in Supabase before using the deletion fix. No new tables are required.

## V2.4.1.2 Ranking Repair Fix
Run `v2_4_1_RANKING_REPAIR_FIX2.sql` after the original V2.4.1 patch. It adds `v24_repair_rankings()` and makes level deletion automatically resequence the entire list, fixing existing gaps such as #40 → #42. The Admin page also includes a manual Repair rankings button.
