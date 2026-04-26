# Soundtrack of Your Life

A personal Last.fm dashboard — 22 years of scrobbles visualised against the backdrop of world events.

Live: **[ideaspect.com/lastfm](https://ideaspect.com/lastfm/)**

## What it shows

- **Hero** — total scrobbles, unique artists, years on Last.fm
- **By the Numbers** — listening hours, biggest week, most diverse year, most obsessive year
- **Timeline** — top albums per year alongside major historical events
- **Musical Eras** — distinct phases of your listening
- **Listening Intensity** — heatmap of scrobbles per week
- **Loyalty & Discovery** — ride-or-die artists vs. fleeting obsessions
- **Current Vibe** — what's on rotation right now

## Stack

Plain HTML / CSS / JS, no build step. Chart.js loaded from CDN. All data lives in `data/*.json` so the site is fully static and deployable to any host.

## Refreshing the data

```bash
cp .env.example .env   # then fill in your Last.fm API key + username
python3 fetch-data.py  # ~10–15 min for full history
git add data/ && git commit -m "Refresh data" && git push
```

The Last.fm API is rate-limited to 4 req/s, which is why the full pull takes a while. The script re-fetches everything; there's no incremental mode.

## Local preview

```bash
./start.sh             # serves on http://localhost:8080
```

## Deployment

Hosted on GitHub Pages. The repo is served at `ideaspect.com/lastfm` because the user-level Pages site (`sirmortimer7.github.io`) has `ideaspect.com` set as its custom domain — project sites under the same account inherit it automatically. No extra DNS or CNAME work needed.
