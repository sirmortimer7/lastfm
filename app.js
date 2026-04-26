/* ===== DATA LOADING ===== */

async function loadJSON(path) {
  // Cache-bust so refreshed data/*.json shows up without a hard reload.
  const resp = await fetch(`${path}?_=${Date.now()}`);
  if (!resp.ok) return null;
  return resp.json();
}

async function loadAllData() {
  const [profile, artistsByYear, tracksByYear, scrobblesByWeek, events, topAlbums, lovedTracks] =
    await Promise.all([
      loadJSON("data/profile.json"),
      loadJSON("data/top-artists-by-year.json"),
      loadJSON("data/top-tracks-by-year.json"),
      loadJSON("data/scrobbles-by-week.json"),
      loadJSON("events.json"),
      loadJSON("data/top-albums.json"),
      loadJSON("data/loved-tracks.json"),
    ]);

  return {
    profile: profile || { playcount: 0, artist_count: 0, registered: 0 },
    artistsByYear: artistsByYear || {},
    tracksByYear: tracksByYear || {},
    scrobblesByWeek: scrobblesByWeek || [],
    events: events || [],
    topAlbums: topAlbums || [],
    lovedTracks: lovedTracks || [],
  };
}

/* ===== UTILITIES ===== */

function formatNumber(n) {
  return n.toLocaleString();
}

function animateCounter(el, target, duration = 2000) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = formatNumber(Math.floor(target * eased));
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

/* ===== HERO ===== */

function renderHero(profile) {
  const regDate = new Date(profile.registered * 1000);
  const years = new Date().getFullYear() - regDate.getFullYear();

  document.getElementById("hero-since").textContent =
    regDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Animate counters on load
  setTimeout(() => {
    animateCounter(document.getElementById("hero-scrobbles"), profile.playcount);
    animateCounter(document.getElementById("hero-artists"), profile.artist_count, 1500);
    animateCounter(document.getElementById("hero-years"), years, 1000);
  }, 300);
}

/* ===== STATS ===== */

function renderStats(profile, scrobblesByWeek, artistsByYear, lovedTracks) {
  const totalMinutes = profile.playcount * 3.5; // rough avg
  const totalHours = Math.round(totalMinutes / 60);
  const totalDays = Math.round(totalHours / 24);

  // Find most active week
  let maxWeek = { scrobbles: 0 };
  let totalWeeklyScrobbles = 0;
  for (const w of scrobblesByWeek) {
    totalWeeklyScrobbles += w.scrobbles;
    if (w.scrobbles > maxWeek.scrobbles) maxWeek = w;
  }

  // Most diverse year (most unique artists)
  let mostDiverseYear = "";
  let maxArtists = 0;
  for (const [year, artists] of Object.entries(artistsByYear)) {
    if (artists.length > maxArtists) {
      maxArtists = artists.length;
      mostDiverseYear = year;
    }
  }

  // Most obsessive year (highest plays for #1 artist)
  let mostObsessiveYear = "";
  let maxTopPlays = 0;
  for (const [year, artists] of Object.entries(artistsByYear)) {
    if (artists.length && artists[0].playcount > maxTopPlays) {
      maxTopPlays = artists[0].playcount;
      mostObsessiveYear = `${year} — ${artists[0].name}`;
    }
  }

  const stats = [
    { value: `~${formatNumber(totalHours)}h`, label: "Total listening time" },
    { value: `~${totalDays} days`, label: "Non-stop playback" },
    { value: formatNumber(profile.playcount), label: "Total scrobbles" },
    { value: formatNumber(profile.artist_count), label: "Unique artists" },
    { value: formatNumber(lovedTracks.length), label: "Loved tracks" },
    { value: maxWeek.date || "—", label: `Biggest week (${maxWeek.scrobbles} scrobbles)` },
    { value: mostDiverseYear, label: `Most diverse year (${maxArtists} artists)` },
    { value: mostObsessiveYear, label: "Most obsessive year" },
  ];

  const grid = document.getElementById("stats-grid");
  grid.innerHTML = stats
    .map(
      (s) => `
    <div class="stat-card">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`
    )
    .join("");
}

/* ===== TIMELINE ===== */

function renderTimeline(artistsByYear, events) {
  const container = document.getElementById("timeline-container");
  const years = Object.keys(artistsByYear).sort();

  // Group events by year
  const eventsByYear = {};
  for (const e of events) {
    const year = e.date.substring(0, 4);
    if (!eventsByYear[year]) eventsByYear[year] = [];
    eventsByYear[year].push(e);
  }

  let html = "";
  for (const year of years) {
    const topArtists = artistsByYear[year].slice(0, 5);
    const yearEvents = eventsByYear[year] || [];

    html += `
      <div class="timeline-year">
        <div class="timeline-music">
          ${topArtists
            .map(
              (a) =>
                `<div class="timeline-artist">${a.name}<span class="plays">${formatNumber(a.playcount)}</span></div>`
            )
            .join("")}
        </div>
        <div class="timeline-center">
          <div class="timeline-line"></div>
          <div class="timeline-dot"></div>
          <div class="timeline-year-label">${year}</div>
          <div class="timeline-line"></div>
        </div>
        <div class="timeline-events">
          ${yearEvents
            .map(
              (e) =>
                `<div class="timeline-event ${e.category}">
                  <span class="event-icon">${e.icon}</span>
                  <div>
                    <div class="event-title">${e.title}</div>
                    <div class="event-date">${e.date}</div>
                  </div>
                </div>`
            )
            .join("")}
        </div>
      </div>`;
  }

  container.innerHTML = html;
}

/* ===== MUSICAL ERAS ===== */

function detectEras(artistsByYear) {
  const years = Object.keys(artistsByYear).sort();
  const eras = [];
  let currentEra = null;

  for (const year of years) {
    const top3 = artistsByYear[year].slice(0, 3).map((a) => a.name);
    const topArtist = top3[0];

    if (!currentEra || !currentEra.topArtists.includes(topArtist)) {
      // New era if the #1 artist changed
      if (currentEra) eras.push(currentEra);
      currentEra = {
        startYear: year,
        endYear: year,
        topArtists: [...new Set(top3)],
        allArtists: {},
        totalScrobbles: 0,
      };
    } else {
      currentEra.endYear = year;
      for (const a of top3) {
        if (!currentEra.topArtists.includes(a)) currentEra.topArtists.push(a);
      }
    }

    // Accumulate plays
    for (const a of artistsByYear[year]) {
      currentEra.allArtists[a.name] =
        (currentEra.allArtists[a.name] || 0) + a.playcount;
      currentEra.totalScrobbles += a.playcount;
    }
  }
  if (currentEra) eras.push(currentEra);

  // Merge very short eras (1 year) with their neighbors if similar
  return eras.filter((e) => e.totalScrobbles > 0);
}

function generateEraName(era) {
  const top = era.topArtists.slice(0, 2);
  if (era.startYear === era.endYear) {
    return `The ${top[0]} Moment`;
  }
  if (top.length === 1) return `The ${top[0]} Era`;
  return `The ${top[0]} & ${top[1]} Years`;
}

function renderEras(artistsByYear) {
  const eras = detectEras(artistsByYear);
  const container = document.getElementById("eras-container");

  const colors = ["#7c5cff", "#ff6b6b", "#4ecdc4", "#f7b731", "#a55eea", "#26de81", "#fd9644"];

  container.innerHTML = eras
    .map((era, i) => {
      const yearRange =
        era.startYear === era.endYear
          ? era.startYear
          : `${era.startYear}–${era.endYear}`;
      const name = generateEraName(era);
      const topSorted = Object.entries(era.allArtists)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      return `
        <div class="era-card" style="border-left: 3px solid ${colors[i % colors.length]}">
          <div class="era-years" style="color: ${colors[i % colors.length]}">${yearRange}</div>
          <div class="era-body">
            <h3>${name}</h3>
            <p class="era-description">${formatNumber(era.totalScrobbles)} scrobbles across this period</p>
            <div class="era-artists">
              ${topSorted
                .map(
                  ([name, count]) =>
                    `<span class="era-artist-tag">${name} <small>(${formatNumber(count)})</small></span>`
                )
                .join("")}
            </div>
          </div>
        </div>`;
    })
    .join("");
}

/* ===== HEATMAP (scrobbles over time bar chart) ===== */

function renderHeatmap(scrobblesByWeek) {
  const ctx = document.getElementById("heatmap-chart").getContext("2d");

  // Downsample to monthly for readability
  const monthly = {};
  for (const w of scrobblesByWeek) {
    const month = w.date.substring(0, 7); // "2005-03"
    monthly[month] = (monthly[month] || 0) + w.scrobbles;
  }

  const labels = Object.keys(monthly).sort();
  const data = labels.map((m) => monthly[m]);

  // Color based on intensity
  const maxVal = Math.max(...data);
  const colors = data.map((v) => {
    const ratio = v / maxVal;
    const r = Math.round(124 + (255 - 124) * ratio);
    const g = Math.round(92 * (1 - ratio));
    const b = Math.round(255 * (1 - ratio * 0.5));
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
  });

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.map((l) => {
        // Show year labels only for January
        return l.endsWith("-01") ? l.substring(0, 4) : "";
      }),
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderWidth: 0,
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => labels[items[0].dataIndex],
            label: (item) => `${formatNumber(item.raw)} scrobbles`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#6b6b7b", font: { size: 11 } },
        },
        y: {
          grid: { color: "rgba(30,30,46,0.5)" },
          ticks: {
            color: "#6b6b7b",
            callback: (v) => formatNumber(v),
          },
        },
      },
    },
  });
}

/* ===== LOYALTY & DISCOVERY ===== */

function renderLoyalty(artistsByYear) {
  const years = Object.keys(artistsByYear).sort();
  const firstYear = parseInt(years[0]);
  const lastYear = parseInt(years[years.length - 1]);
  const span = lastYear - firstYear + 1;

  // Track which years each artist appears in
  const artistPresence = {};
  const artistTotalPlays = {};

  for (const year of years) {
    for (const a of artistsByYear[year].slice(0, 20)) {
      if (!artistPresence[a.name]) artistPresence[a.name] = new Set();
      artistPresence[a.name].add(year);
      artistTotalPlays[a.name] = (artistTotalPlays[a.name] || 0) + a.playcount;
    }
  }

  // Categorize
  const lifers = []; // 10+ years
  const loyals = []; // 5-9 years
  const flings = []; // 1-2 years but high plays

  for (const [name, yearSet] of Object.entries(artistPresence)) {
    const yearsActive = yearSet.size;
    const entry = {
      name,
      yearsActive,
      totalPlays: artistTotalPlays[name],
      firstYear: Math.min(...[...yearSet].map(Number)),
      lastYear: Math.max(...[...yearSet].map(Number)),
    };

    if (yearsActive >= 10) lifers.push(entry);
    else if (yearsActive >= 5) loyals.push(entry);
    else if (entry.totalPlays > 500 && yearsActive <= 2) flings.push(entry);
  }

  lifers.sort((a, b) => b.totalPlays - a.totalPlays);
  loyals.sort((a, b) => b.totalPlays - a.totalPlays);
  flings.sort((a, b) => b.totalPlays - a.totalPlays);

  const container = document.getElementById("loyalty-container");

  function renderGroup(title, icon, artists, color, max = 10) {
    if (!artists.length) return "";
    const topN = artists.slice(0, max);
    const maxPlays = Math.max(...topN.map((a) => a.totalPlays));

    return `
      <div class="loyalty-group-title"><span class="loyalty-icon">${icon}</span> ${title}</div>
      ${topN
        .map(
          (a) => `
        <div class="loyalty-bar">
          <div class="loyalty-name">${a.name}</div>
          <div class="loyalty-track">
            <div class="loyalty-fill" style="width: ${(a.totalPlays / maxPlays) * 100}%; background: ${color};"></div>
          </div>
          <div class="loyalty-years-label">${a.yearsActive}y</div>
        </div>`
        )
        .join("")}`;
  }

  container.innerHTML =
    renderGroup("Ride or Die (10+ years)", "\u{1F480}", lifers, "var(--accent)") +
    renderGroup("Loyal Companions (5-9 years)", "\u{1F3B8}", loyals, "var(--accent3)") +
    renderGroup("Intense Flings (high plays, short stay)", "\u{26A1}", flings, "var(--accent2)");
}

/* ===== CURRENT VIBE ===== */

function renderCurrent(artistsByYear) {
  const years = Object.keys(artistsByYear).sort();
  const currentYear = years[years.length - 1];
  const current = artistsByYear[currentYear].slice(0, 8);
  const container = document.getElementById("current-container");

  container.innerHTML = current
    .map(
      (a) => `
    <div class="current-card">
      <div class="current-info">
        <h4>${a.name}</h4>
        <p>${formatNumber(a.playcount)} plays in ${currentYear}</p>
      </div>
    </div>`
    )
    .join("");
}

/* ===== SCROLL ANIMATIONS ===== */

function setupScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      }
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(".section:not(.hero)").forEach((s) => observer.observe(s));
}

/* ===== INIT ===== */

async function init() {
  const data = await loadAllData();
  const hasProfile = data.profile.playcount > 0;
  const hasYearlyData = Object.keys(data.artistsByYear).length > 0;
  const hasWeeklyData = data.scrobblesByWeek.length > 0;

  if (!hasProfile) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#6b6b7b;font-family:Inter,sans-serif;text-align:center;padding:40px;">
        <div>
          <h2 style="color:#e8e8ef;margin-bottom:16px;">Data not found</h2>
          <p>Run <code style="background:#1a1a25;padding:4px 8px;border-radius:4px;">python3 fetch-data.py</code> first to pull your Last.fm data.</p>
        </div>
      </div>`;
    return;
  }

  renderHero(data.profile);
  renderStats(data.profile, data.scrobblesByWeek, data.artistsByYear, data.lovedTracks);

  if (hasYearlyData) {
    renderTimeline(data.artistsByYear, data.events);
    renderEras(data.artistsByYear);
    renderLoyalty(data.artistsByYear);
    renderCurrent(data.artistsByYear);
  } else {
    for (const id of ["timeline", "eras", "loyalty", "current"]) {
      document.getElementById(id).querySelector(".section-subtitle").textContent =
        "Waiting for weekly chart data to finish fetching...";
    }
  }

  if (hasWeeklyData) {
    renderHeatmap(data.scrobblesByWeek);
  } else {
    document.querySelector("#heatmap .section-subtitle").textContent =
      "Waiting for weekly chart data to finish fetching...";
  }

  setupScrollAnimations();
}

init();
