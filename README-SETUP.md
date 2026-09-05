# DIDDY DEMON LIST — V2

## What this version includes
- Main List #1–45, Extended #46–100, Legacy #100+
- Supabase database + email/password auth
- Admin-only editing enforced by Row Level Security
- Editable #1–100 point values; #1 starts at exactly 100
- Automatic player points from victory records
- Removing a victory removes its points
- Moving a level changes the current points automatically
- Placement history
- Player profiles with points, victories, highest victory, average placement
- Optional verification videos for levels and victors
- Optional thumbnails for levels
- Search/sort/filter
- Statistics
- Changelog
- JSON backup export
- Responsive mobile layout

## 1. Create a NEW GitHub repo
Make a new repo named something like `diddy-demon-list-v2`. Upload every file in this folder to the repo root.

## 2. Create Supabase project
Create a free Supabase project. In SQL Editor, paste and run `supabase_schema.sql`.

## 3. Create your admin account
In Supabase Authentication, create a user with your email/password. Copy that user's UUID. Then run:

insert into public.admins(user_id) values ('YOUR-AUTH-USER-UUID');

Do not share or put a service_role/secret key anywhere in this repo.

## 4. Connect the website
Open `config.js` and paste:
- Supabase Project URL
- Supabase publishable/anon key

The publishable/anon key is okay in frontend code. The service_role/secret key is NOT.

## 5. GitHub Pages
GitHub repo → Settings → Pages → Deploy from branch → `main` → `/ (root)` → Save.

After GitHub builds the page, your site will be at the GitHub Pages URL shown there.

## 6. Add your screenshot levels
The old static ZIP is NOT treated as the authoritative list. Use your four list screenshots as the source of truth for the initial level names/verifiers/holders. Enter them in Admin. The Extended and Legacy lists start empty.

## Optional: custom domain
GitHub Pages can use a custom domain later. This does not change Supabase.


## V17 — EVOLUTION
Run `v17_schema_patch.sql` once after V16.2. It adds player/level statistics views, automated news feed, #1 Hall history, saved Time Machine snapshots, and the V17 feature pages. Keep your existing `config.js`.
