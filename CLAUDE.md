# CLAUDE.md — Soundtrack of Your Life

## Purpose

Personal Last.fm dashboard for sirmortimer — visualises 22 years of scrobbles against a backdrop of historical events. Single page, scroll-driven, no interactivity beyond Chart.js renders.

## Stack

- HTML / CSS / vanilla JS (no framework, no build tool, no npm)
- Chart.js loaded from CDN
- `data/*.json` is the only data source — fetched separately, never queried client-side at runtime
- `fetch-data.py` (Python 3, `requests` + `python-dotenv`) refreshes `data/` from the Last.fm API
- Hosted on GitHub Pages at [ideaspect.com/lastfm](https://ideaspect.com/lastfm/)

## Architecture rules

- **Stay static.** No backend, no API calls from the browser. Anything dynamic gets pre-computed in `fetch-data.py` and saved to `data/`.
- **No build step.** The repo must be uploadable to any static host as-is.
- **Add new sections in `index.html`** with a stable `id`, then bind data in `app.js` via `document.getElementById(...)`. Follow the existing section pattern (title, subtitle, container).
- **Aggregations belong in `fetch-data.py`**, not `app.js`. The browser should consume ready-to-render JSON.
- **Chart.js only.** Don't add a second charting library.

## Constraints

- `.env` is gitignored and holds the Last.fm API key — never commit it, never log its contents.
- `data/` IS committed (the static site needs it to render). It's ~4 MB; if it grows much past 10 MB, reconsider the granularity of `weekly-charts.json`.
- The Last.fm API rate-limits at 5 req/s; `fetch-data.py` paces at 4. Don't lower the sleep.
- `fetch-data.py` resumes from the cached `weekly-charts.json`, so a refresh after recent listening is fast (~30 s). A full re-fetch from scratch is 10–15 min.
- Custom domain is inherited from the user-site repo (`sirmortimer7.github.io` → `ideaspect.com`). Do **not** add a `CNAME` file to this repo — it would override the inheritance and break the URL.

## Refresh + deploy workflow

```bash
python3 fetch-data.py
git add data/ && git commit -m "Refresh data" && git push
# Pages rebuild takes ~1 min, then ideaspect.com/lastfm reflects new numbers
```
