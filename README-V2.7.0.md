# V2.7.0 — THE ENXY MAJOR UPDATE

V2.7 adds a dedicated **Enxy Intelligence** layer on top of the existing DIDDY Demon List platform.

## Enxy Intelligence
- Live command center at `enxy.html`.
- Current #1 level and #1 player context.
- 24-hour and 7-day victory pulse.
- 7-day active-player count.
- 7-day points generated from the current point table.
- 24-hour placement movement detection.
- Most-active players and levels.
- Current Main / Extended / Legacy structure.
- Automatic 60-second refresh.
- Generated Enxy readout that explains the current state without changing official data.

## Preservation
- Existing pages and features are preserved.
- Existing Supabase schema is reused; no new tables are required by Enxy.
- `config.js` is intentionally not included or overwritten.
- Seasons remain excluded.
- Older release notes remain in `release-notes.js`.

## Cache verification
All existing HTML asset cache versions were bumped to `2.7.0`.

## Regression checklist
- [ ] Open the main list and verify levels render.
- [ ] Open Enxy and verify live data loads.
- [ ] Verify player/level links from Enxy.
- [ ] Verify existing Simulator, Achievements, Changelog, Universe, Battles, News, Time Machine, Eras, Power, Hall of Fame, Search, and Admin pages.
- [ ] Verify `config.js` was not replaced.
- [ ] Verify `release-notes.js` shows V2.7.0 first and keeps previous releases.
- [ ] Verify Seasons-excluded behavior remains unchanged.
