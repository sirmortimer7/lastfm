"""
Fetch Last.fm listening history and save as JSON files.
Run once — takes ~10-15 min for full history due to API rate limits.
"""

import os
import json
import time
import requests
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("LASTFM_API_KEY")
USERNAME = os.getenv("LASTFM_USERNAME")
BASE_URL = "http://ws.audioscrobbler.com/2.0/"
DATA_DIR = Path("data")
RATE_LIMIT = 0.25  # 4 requests/sec

DATA_DIR.mkdir(exist_ok=True)


def api_call(method, **params):
    """Make a Last.fm API call with rate limiting."""
    params.update({
        "method": method,
        "user": USERNAME,
        "api_key": API_KEY,
        "format": "json",
    })
    time.sleep(RATE_LIMIT)
    resp = requests.get(BASE_URL, params=params)
    resp.raise_for_status()
    return resp.json()


def save_json(filename, data):
    path = DATA_DIR / filename
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Saved {path}")


def fetch_profile():
    """Fetch basic profile info."""
    print("Fetching profile...")
    data = api_call("user.getinfo")
    profile = data["user"]
    save_json("profile.json", {
        "username": profile["name"],
        "real_name": profile.get("realname", ""),
        "playcount": int(profile["playcount"]),
        "artist_count": int(profile.get("artist_count", 0)),
        "track_count": int(profile.get("track_count", 0)),
        "album_count": int(profile.get("album_count", 0)),
        "registered": int(profile["registered"]["unixtime"]),
        "registered_date": datetime.fromtimestamp(
            int(profile["registered"]["unixtime"])
        ).isoformat(),
        "image": profile["image"][-1]["#text"] if profile.get("image") else "",
    })


def fetch_weekly_chart_list():
    """Get the list of all available weekly chart periods."""
    print("Fetching weekly chart list...")
    data = api_call("user.getweeklychartlist")
    charts = data["weeklychartlist"]["chart"]
    save_json("weekly-chart-list.json", charts)
    return charts


def fetch_weekly_charts(chart_list):
    """Fetch artist + track charts for every week. This is the heavy lift."""
    # Resume support — load existing data if available
    cache_path = DATA_DIR / "weekly-charts.json"
    existing = []
    fetched_periods = set()

    if cache_path.exists():
        with open(cache_path) as f:
            existing = json.load(f)
        fetched_periods = {(w["from"], w["to"]) for w in existing}
        print(f"  Found {len(existing)} cached weeks, resuming...")

    total = len(chart_list)
    results = list(existing)

    for i, chart in enumerate(chart_list):
        from_ts = chart["from"]
        to_ts = chart["to"]

        if (from_ts, to_ts) in fetched_periods:
            continue

        pct = ((i + 1) / total) * 100
        week_date = datetime.fromtimestamp(int(from_ts)).strftime("%Y-%m-%d")
        print(f"  [{i+1}/{total}] {pct:.0f}% — Week of {week_date}", end="\r")

        # Fetch artist chart for this week
        try:
            artist_data = api_call(
                "user.getweeklyartistchart", **{"from": from_ts, "to": to_ts}
            )
            artists = artist_data.get("weeklyartistchart", {}).get("artist", [])
            if isinstance(artists, dict):
                artists = [artists]
            # Keep top 20 per week to manage file size
            artists = [
                {"name": a["name"], "playcount": int(a["playcount"])}
                for a in artists[:20]
            ]
        except Exception:
            artists = []

        # Fetch track chart for this week
        try:
            track_data = api_call(
                "user.getweeklytrackchart", **{"from": from_ts, "to": to_ts}
            )
            tracks = track_data.get("weeklytrackchart", {}).get("track", [])
            if isinstance(tracks, dict):
                tracks = [tracks]
            tracks = [
                {
                    "name": t["name"],
                    "artist": t["artist"]["#text"],
                    "playcount": int(t["playcount"]),
                }
                for t in tracks[:20]
            ]
        except Exception:
            tracks = []

        results.append({
            "from": from_ts,
            "to": to_ts,
            "artists": artists,
            "tracks": tracks,
        })

        # Save progress every 50 weeks
        if len(results) % 50 == 0:
            save_json("weekly-charts.json", results)

    print()
    save_json("weekly-charts.json", results)
    return results


def aggregate_by_year(weekly_charts):
    """Roll up weekly data into yearly summaries."""
    print("Aggregating yearly data...")

    artists_by_year = {}
    tracks_by_year = {}
    scrobbles_by_week = []

    for week in weekly_charts:
        from_ts = int(week["from"])
        year = str(datetime.fromtimestamp(from_ts).year)
        week_date = datetime.fromtimestamp(from_ts).strftime("%Y-%m-%d")

        # Count total scrobbles this week
        week_total = sum(a["playcount"] for a in week["artists"])
        scrobbles_by_week.append({
            "date": week_date,
            "from": week["from"],
            "to": week["to"],
            "scrobbles": week_total,
        })

        # Accumulate artist plays per year
        if year not in artists_by_year:
            artists_by_year[year] = {}
        for a in week["artists"]:
            name = a["name"]
            artists_by_year[year][name] = (
                artists_by_year[year].get(name, 0) + a["playcount"]
            )

        # Accumulate track plays per year
        if year not in tracks_by_year:
            tracks_by_year[year] = {}
        for t in week["tracks"]:
            key = f"{t['artist']} — {t['name']}"
            tracks_by_year[year][key] = (
                tracks_by_year[year].get(key, 0) + t["playcount"]
            )

    # Sort and format
    top_artists = {}
    for year, artists in sorted(artists_by_year.items()):
        sorted_artists = sorted(artists.items(), key=lambda x: x[1], reverse=True)
        top_artists[year] = [
            {"name": name, "playcount": count}
            for name, count in sorted_artists[:50]
        ]

    top_tracks = {}
    for year, tracks in sorted(tracks_by_year.items()):
        sorted_tracks = sorted(tracks.items(), key=lambda x: x[1], reverse=True)
        top_tracks[year] = [
            {"name": name, "playcount": count}
            for name, count in sorted_tracks[:50]
        ]

    save_json("top-artists-by-year.json", top_artists)
    save_json("top-tracks-by-year.json", top_tracks)
    save_json("scrobbles-by-week.json", scrobbles_by_week)


def fetch_top_albums_by_year():
    """Fetch top albums for each year using the API's period-based endpoint.
    Last.fm doesn't have per-year periods, so we use the weekly chart approach
    would be needed. Instead, fetch overall top albums as a supplement."""
    print("Fetching all-time top albums...")
    results = []
    for page in range(1, 6):  # Top 250 albums
        data = api_call("user.gettopalbums", period="overall", page=page, limit=50)
        albums = data.get("topalbums", {}).get("album", [])
        for a in albums:
            results.append({
                "name": a["name"],
                "artist": a["artist"]["name"],
                "playcount": int(a["playcount"]),
                "image": a["image"][-1]["#text"] if a.get("image") else "",
            })
    save_json("top-albums.json", results)


def fetch_loved_tracks():
    """Fetch loved/favorited tracks."""
    print("Fetching loved tracks...")
    results = []
    page = 1
    while True:
        data = api_call("user.getlovedtracks", page=page, limit=200)
        tracks = data.get("lovedtracks", {}).get("track", [])
        if not tracks:
            break
        for t in tracks:
            results.append({
                "name": t["name"],
                "artist": t["artist"]["name"],
                "date": t.get("date", {}).get("uts", ""),
                "date_text": t.get("date", {}).get("#text", ""),
            })
        total_pages = int(data["lovedtracks"]["@attr"]["totalPages"])
        if page >= total_pages:
            break
        page += 1
    save_json("loved-tracks.json", results)


if __name__ == "__main__":
    print(f"Last.fm Data Fetcher for {USERNAME}")
    print("=" * 50)

    if not API_KEY:
        print("ERROR: LASTFM_API_KEY not found in .env")
        exit(1)

    fetch_profile()
    fetch_loved_tracks()
    fetch_top_albums_by_year()

    chart_list = fetch_weekly_chart_list()
    print(f"Found {len(chart_list)} weekly chart periods")

    weekly_charts = fetch_weekly_charts(chart_list)
    aggregate_by_year(weekly_charts)

    print("\nDone! All data saved to data/")
