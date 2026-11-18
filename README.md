# Climate Shield · Team Zhapzody

Climate risk early-warning prototype for the International AI Builders Congress 2026.
A static app (`public/index.html`) plus one serverless function (`api/feed.js`) that fetches real rainfall.

## Deploy (GitHub + Vercel, about 3 minutes)
1. Push this folder to a new GitHub repo.
2. On vercel.com choose **Add New → Project**, import the repo, keep Framework Preset **Other**. No build command and no environment variables.
3. Deploy. Open the site → **Risk Atlas → Live GFS forecast** or **ERA5 reanalysis**.

Local test: `npx vercel dev`

## What is real and what is not
- **Real:** rainfall from NOAA GFS (forecast) and ERA5 (reanalysis), served through the free [Open-Meteo](https://open-meteo.com) API (CC BY 4.0, free for non-commercial use; a commercial licence is needed beyond that). Keep the attribution.
- **Not real:** per-division terrain, soil and exposure weights are illustrative placeholders. The risk score is a transparent weighted heuristic, not a validated model. The RL agent trains on a simulator, so its numbers are not real-event outcomes. Nothing here is an official warning.
- Until a feed is loaded, every number is labelled DEMO DATA.

## Direct Copernicus / NOAA ingestion (optional)
`tools/ingest.py` pulls ERA5 from the Copernicus CDS (needs a free key in `~/.cdsapirc`) or GFS via Herbie, and writes `climate_shield_feed.json` for the page's **Load real feed** button. Written without network access and not yet run against the live services.

## Known limitations
- GFS window is the three calendar days from 00:00 UTC today, not exactly the next 72 hours.
- Division centroids, not polygon averages. No back-testing yet. ViT, LSTM and generative-weather modules are planned, not built.
- The `/api/feed` function was tested against mocked responses; confirm it against the live Open-Meteo API after deploying.

## Layout
`public/` index.html + css/styles.css + js/app.js + favicon · `api/feed.js` data endpoint · `tools/ingest.py` offline ingestion · `tests/` API tests (`npm test`) · `.github/workflows/ci.yml` syntax check + tests on every push · `vercel.json` static output and security headers

## Exclusive features (beyond the brief)
- **Command palette** (Ctrl/Cmd + K): jump to any view or division, start the demo, load live data, train the RL agent.
- **Storm timeline:** replay 72 h of simulated rain; risk evolves live with a lead-time readout against your alert threshold.
- **Rain animation** clipped to the country outline, density tied to the scenario.
- **Plain-language briefing** written by fixed rules (not an LLM) from the engine output.
- **Shareable scenario links** that reproduce rainfall, division, EarthTwin and Response settings.
- **Event replay & verification:** replay Sylhet 2022, Cyclone Remal 2024 or the Aug 2024 eastern floods with real ERA5 hourly rainfall (the Storm timeline then draws real hourly bars), tick the divisions officially reported as flooded, and get hits, misses, false alarms, detection rate and false-alarm ratio. Eight divisions is only indicative, not validation.
- Cross-fade view transitions, animated score counter, staggered reveals, magnetic buttons (all off for reduced-motion).

## Accessibility
Skip link, keyboard-operable map regions and graph nodes (Tab, Enter or Space), visible focus rings, reduced-motion support, print stylesheet (Print brief button).
