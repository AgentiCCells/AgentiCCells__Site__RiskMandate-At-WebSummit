# RiskMandate at Web Summit

A one-page site for RiskMandate at Web Summit Lisbon 2026 (9 to 12 November 2026): the film "Know the Reach" as the hero, RiskMandate's three questions for any AI agent (reach, mandate and gap), crops of the live visualisations from the walkthrough filmed at the stand, photos and a short clip from the week, links to riskmandate.ai and promptugal.news, and the read-only key of the vault that holds the original files.

- Live at https://riskmandate-at-websummit.agenticcells.site (version at /version.json).
- Made by the AgentiCCells site factory from request `requests/2026-11-16__riskmandate-at-websummit/` in AgentiCCells__Site__Factory, seeded from AgentiCCells__Site__Template.
- Media: none in this repository. Every video and image is read at view time from a public sgit vault (vault id `yvytv5bo`, folder `web/`; republished from Dinis Cruz's materials vault with location metadata removed) through the SG/Send API at send.sgraph.ai, and decrypted in the browser by `src/vault.js` (WebCrypto AES-256-GCM, no dependencies). Videos are H.264 fragmented MP4 in 6-second segments, streamed with Media Source Extensions; images are WebP. The read key is in `src/vault.json` and written into the page, published on Dinis's instruction with the `sgit_public_read_` prefix, following https://sgit.ai/demos/vaults/publishing.html. `assets/share/riskmandate-at-websummit-1200x630.jpg` (a frame from the film with the title, 1200x630, metadata stripped) is the one image kept in the repository, for link previews; the validator checks the Open Graph tags on every page.
- Release: `scripts/release.sh` (build, validate, leak scan, then push to dev; CI deploys and tags v0.1.N).

Licences: code Apache-2.0; text CC BY 4.0. The film, photos and recordings come from the RiskMandate team, provided by Dinis Cruz for this site.
