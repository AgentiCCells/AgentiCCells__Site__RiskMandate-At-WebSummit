# REALITY.md: what exists now

- Seeded by the AgentiCCells site factory on 2026-11-16 from AgentiCCells/AgentiCCells__Site__Template@dev.
- Its live state is recorded in requests/2026-11-16__riskmandate-at-websummit/status.json in AgentiCCells__Site__Factory.
- 2026-11-16, site-riskmandate-at-websummit@AgentiCCells.dinis: the placeholder was replaced by the full one-page site (v0.1.3), then (v0.1.4) every video and image moved out of git into the materials vault p35v1fwp, folder web/ (122 files, 81 MB, each under 3.3 MB), pushed with a vault key Dinis gave in the session (kept outside the repository, never committed). The page reads web/manifest.json and the files through https://send.sgraph.ai/api/vault/read/ (no login, CORS open) and decrypts them in the browser (src/vault.js).
- web/ holds: the film "Know the Reach" (1080p 43.5 MB, 720p 28.0 MB, 36 segments each), the hero loop (1080p and 720p, subtitles blurred), the 37-second clip from the stand, four crops from Videos/IMG_1339-clean.mov (0:54, 3:08, 5:28, 5:36), ten photos and three posters. Photos/IMG_1365 is cropped so a car's number plate does not show.
- Large originals (over about 6 MB) cannot be read from a browser: the API returns 502 and the S3 presigned links have no CORS. That is why web/ exists.
- The read key is published as sgit_public_read_{key}:p35v1fwp in src/vault.json, on Dinis's instruction. The leak scan is unchanged.
- The media files from v0.1.3 (about 80 MB) are still in git history; history was not rewritten.
- No person is named in the site's own text. The film's end credits, and names drawn inside the screen visualisations, appear as they are in the materials.
- Not yet done: the full stand walkthrough video (6:45) is not on the site; only frames from it.
