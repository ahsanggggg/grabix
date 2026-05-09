# CLAUDE.md — GRABIX Project Reference

> **How to use this file:**
> Paste this entire file at the start of any AI chat session before describing your problem.
> The AI will then know exactly what GRABIX is, how every piece connects, and which files to ask for.
> After fixing a bug or making a major change, update the relevant section so this file stays accurate.

---

## 1. What Is GRABIX?

GRABIX is a **Windows desktop application** for downloading, streaming, and managing all kinds of media — movies, TV shows, anime, manga — from one place.

- Users can paste any video URL and download it (via yt-dlp + aria2c)
- Users can browse and stream Movies, TV Shows, Anime, and read Manga — all with metadata from TMDB, IMDb, AniList, MangaDex
- Users can manage a local library of downloaded files
- The app has profiles, favorites, ratings, watch history, adult content lock, and a built-in video player
- It is a **Tauri v2** desktop app (Rust shell wrapping a React web UI), with a separate **Python FastAPI** backend that runs locally on the user's machine

---

## 2. Tech Stack

### Frontend (UI)
| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 5.8 |
| Styling | Tailwind CSS v4 |
| Build tool | Vite 7 |
| Desktop shell | Tauri v2 (Rust) |
| Video playback | hls.js |
| Auth/DB (optional) | Supabase JS client |
| Package manager | npm |

### Backend (local server)
| Layer | Technology |
|---|---|
| Framework | Python + FastAPI + Uvicorn |
| Download engine | yt-dlp + aria2c + FFmpeg |
| HTTP client | httpx + curl_cffi |
| Database | SQLite (via app/services/db_helpers.py) |
| Content APIs | TMDB, IMDb (cinemagoer), Consumet, MovieBox, MangaDex, AniList, Jikan, ComicK |
| Package manager | pip |

### Desktop (Rust / Tauri)
- Entry: `grabix-ui/src-tauri/src/main.rs` + `lib.rs`
- Bundles the Python backend binary and frontend into an NSIS installer
- Backend port: `8000` by default (configurable via `GRABIX_BACKEND_PORT`)
- Frontend communicates with backend at `http://127.0.0.1:8000`

---

## 3. Project File Structure

```
grabix-master/
│
├── CLAUDE.md                        ← YOU ARE HERE
├── README.md
├── run.bat                          ← Starts both backend + frontend (dev)
├── 1__Backend.bat                   ← Starts backend only
├── 2__Frontend.bat                  ← Starts frontend only
├── build-fast.bat                   ← Quick build script
├── grabix-backend.spec              ← PyInstaller spec (bundles Python backend)
│
├── backend/                         ← PYTHON BACKEND (FastAPI)
│   ├── main.py                      ← ★ MAIN ENTRY POINT — FastAPI app, all routers registered here
│   ├── db_helpers.py                ← ⚠️ SHIM ONLY — re-exports from app/services/db_helpers.py
│   ├── library_helpers.py           ← ⚠️ SHIM ONLY — re-exports from app/services/library_helpers.py
│   ├── streaming_helpers.py         ← ⚠️ SHIM ONLY — re-exports from app/services/streaming_helpers.py
│   ├── requirements.txt             ← Python dependencies
│   ├── runtime-config.json          ← Runtime overrides (port, TMDB token, paths)
│   │
│   ├── app/
│   │   ├── routes/                  ← FastAPI routers (each file = one feature area)
│   │   │   ├── downloads.py         ← /downloads — list, add, cancel, pause/resume downloads
│   │   │   ├── streaming.py         ← /stream — stream proxy, HLS variants, embed resolution
│   │   │   ├── metadata.py          ← /metadata — TMDB movie/TV details, search
│   │   │   ├── providers.py         ← /providers — anime/movie stream provider status + resolution
│   │   │   ├── settings.py          ← /settings — read/write user settings
│   │   │   ├── manga.py             ← /manga — manga search, chapters, pages
│   │   │   ├── subtitles.py         ← /subtitles — subtitle fetch and proxy
│   │   │   ├── adblock.py           ← /adblock — ad filter list management
│   │   │   └── consumet.py          ← /consumet — anime episode sources (Consumet API wrapper)
│   │   │
│   │   └── services/                ← ★ ALL BUSINESS LOGIC LIVES HERE
│   │       ├── db_helpers.py        ← ★ SQLite DB connection, all download job CRUD, settings load/save
│   │       ├── streaming_helpers.py ← ★ HLS proxy, stream URL extraction, embed resolvers
│   │       ├── library_helpers.py   ← ★ Library index builder, DB migration
│   │       ├── providers.py         ← Re-export shim (imports from split files below)
│   │       ├── provider_types.py    ← BaseProviderAdapter, ProviderPolicy, error types
│   │       ├── provider_registry.py ← ProviderRegistry class (circuit breaker pattern)
│   │       ├── provider_adapters.py ← Concrete adapters for each streaming provider
│   │       ├── provider_resolvers.py← resolve_movie_playback(), resolve_tv_playback()
│   │       ├── provider_helpers.py  ← Pure helper functions for stream resolution
│   │       ├── tmdb.py              ← TMDB API calls (server-side, cached)
│   │       ├── imdb.py              ← IMDb data via cinemagoer
│   │       ├── subtitles.py         ← Subtitle download/conversion logic
│   │       ├── settings_service.py  ← Settings read/write logic, adult content password
│   │       ├── runtime_config.py    ← Reads runtime-config.json + env vars (port, paths, tokens)
│   │       ├── runtime_state.py     ← RuntimeStateRegistry — shared in-memory state (downloads dict)
│   │       ├── security.py          ← URL validation, path safety, allowed hosts
│   │       ├── network_policy.py    ← Outbound URL policy enforcement
│   │       ├── desktop_auth.py      ← Desktop auth token validation (X-Grabix-Auth header)
│   │       ├── errors.py            ← json_error_response() helper
│   │       ├── logging_utils.py     ← Structured logging, log file paths
│   │       ├── adblock_service.py   ← Ad filter list download + matching
│   │       ├── archive_installer.py ← ZIP extraction for runtime tool installs
│   │       ├── history.py           ← Watch history helpers
│   │       ├── stream_extractors.py ← Low-level stream URL extraction
│   │       ├── manga_anilist.py     ← AniList manga API
│   │       ├── manga_comick.py      ← ComicK manga API
│   │       ├── manga_jikan.py       ← Jikan (MyAnimeList) manga API
│   │       ├── manga_mangadex.py    ← MangaDex API
│   │       └── manga_cache.py       ← Manga result caching
│   │
│   ├── core/                        ← Infrastructure helpers (Phase 2 split)
│   │   ├── main.py                  ← ⚠️ OLD/duplicate — DO NOT USE as entry point
│   │   ├── cache.py                 ← SQLite-backed cache primitives
│   │   ├── cache_ops.py             ← Cache get/set/refresh ops + /cache router
│   │   ├── circuit_breaker.py       ← CircuitBreaker class for provider fault tolerance
│   │   ├── download_helpers.py      ← Download normalization, category inference, auto-retry
│   │   ├── health.py                ← /health /capabilities /diagnostics endpoints
│   │   ├── network_monitor.py       ← Background network monitoring
│   │   ├── state.py                 ← Shared state wiring
│   │   └── utils.py                 ← General utilities
│   │
│   ├── downloads/
│   │   ├── engine.py                ← ⚠️ OVERSIZED (57KB) — download engine (yt-dlp/aria2c wrapper)
│   │   └── downloads_init.py        ← Download subsystem initializer
│   │
│   ├── moviebox/                    ← MovieBox content provider
│   │   ├── moviebox_fetchers.py     ← Fetch movie/TV data from MovieBox API
│   │   ├── moviebox_helpers.py      ← URL builders, response normalizers
│   │   ├── moviebox_loader.py       ← Background loader + session restore
│   │   └── routes.py                ← /moviebox router
│   │
│   └── tests/                       ← pytest test suite
│       ├── test_features.py
│       ├── test_security.py
│       ├── test_runtime.py
│       └── ... (other test files)
│
└── grabix-ui/                       ← REACT FRONTEND (Tauri app)
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    │
    ├── src/
    │   ├── main.tsx                 ← React entry point (mounts <App />)
    │   ├── App.tsx                  ← Root component — routing, runtime health polling, page shell
    │   ├── App.css / index.css      ← Global styles and CSS variables
    │   │
    │   ├── pages/                   ← One file per page/view
    │   │   ├── DownloaderPage.tsx
    │   │   ├── ConverterPage.tsx
    │   │   ├── LibraryPage.tsx      ← ⚠️ OVERSIZED (45KB) — needs splitting
    │   │   ├── MangaPage.tsx        ← ⚠️ OVERSIZED (54KB) — needs splitting
    │   │   ├── MediaPage.tsx        ← ⚠️ OVERSIZED (53KB) — needs splitting
    │   │   ├── MoviesPage.tsx       ← ⚠️ OVERSIZED (37KB) — needs splitting
    │   │   ├── TVSeriesPage.tsx     ← ⚠️ OVERSIZED (37KB) — needs splitting
    │   │   ├── MovieBoxPage.tsx     ← ⚠️ OVERSIZED (39KB) — needs splitting
    │   │   ├── RatingsPage.tsx      ← ⚠️ OVERSIZED (65KB) — needs splitting
    │   │   ├── SettingsPage.tsx     ← ⚠️ OVERSIZED (55KB) — needs splitting
    │   │   ├── GenrePage.tsx
    │   │   ├── FavoritesPage.tsx
    │   │   ├── WatchHistoryPage.tsx
    │   │   ├── ContinueWatchingPage.tsx
    │   │   ├── TopImdbPage.tsx
    │   │   ├── NewAndHotPage.tsx
    │   │   ├── RecentlyAddedPage.tsx
    │   │   ├── BrowsePage.tsx
    │   │   ├── ExplorePage.tsx
    │   │   ├── DownloaderPreview.tsx
    │   │   ├── QueueCard.tsx
    │   │   ├── downloader.types.ts
    │   │   └── useDownloaderQueue.ts
    │   │
    │   ├── components/
    │   │   ├── Sidebar.tsx
    │   │   ├── Topbar.tsx
    │   │   ├── AppToast.tsx
    │   │   ├── CachedImage.tsx
    │   │   ├── DownloadOptionsModal.tsx
    │   │   ├── ErrorBoundary.tsx
    │   │   ├── Icons.tsx            ← ★ ALL icons here (includes IconHeart — merged May 2026)
    │   │   ├── OfflineBanner.tsx
    │   │   ├── WatchdogBanner.tsx
    │   │   ├── PageStates.tsx
    │   │   ├── SubtitlePanel.tsx
    │   │   ├── TrimSlider.tsx
    │   │   ├── VidSrcPlayer.tsx     ← ★ The real VidSrc player (32KB)
    │   │   │
    │   │   ├── player/              ← Custom HLS video player
    │   │   │   ├── useHlsEngine.ts
    │   │   │   ├── usePlayerControls.ts
    │   │   │   ├── usePlayerState.ts
    │   │   │   ├── useSourceManager.ts
    │   │   │   ├── useSubtitleEngine.ts
    │   │   │   ├── MiniPlayer.tsx
    │   │   │   ├── NextEpisodeCountdown.tsx
    │   │   │   ├── SkipButton.tsx
    │   │   │   ├── SpeedSelector.tsx
    │   │   │   ├── helpers.ts
    │   │   │   └── types.ts
    │   │   │
    │   │   ├── movies/              ← Movie browsing components
    │   │   ├── tv/                  ← TV show browsing components
    │   │   ├── search/              ← Search UI components
    │   │   ├── shared/              ← Generic reusable components
    │   │   ├── profile/             ← User profile components
    │   │   └── hero/
    │   │
    │   ├── context/                 ← React Context providers
    │   │   ├── ThemeContext.tsx
    │   │   ├── FavoritesContext.tsx
    │   │   ├── ContentFilterContext.tsx
    │   │   ├── RuntimeHealthContext.tsx
    │   │   └── ProfileContext.tsx
    │   │
    │   ├── hooks/                   ← Custom React hooks
    │   │   ├── useContinueWatching.ts
    │   │   ├── useMiniPlayer.ts
    │   │   ├── useNotifications.ts
    │   │   ├── useRatings.ts
    │   │   ├── useRemindMe.ts
    │   │   └── useSeenIds.ts
    │   │
    │   └── lib/                     ← Utility libraries
    │       ├── api.ts               ← ★ Backend API client (use this for ALL backend calls)
    │       ├── tmdb.ts              ← TMDB browser-side calls (falls back to backend if no token)
    │       ├── appSettings.ts
    │       ├── cache.ts
    │       ├── consumetProviders.ts
    │       ├── contentFilter.ts
    │       ├── downloads.ts
    │       ├── imdbCharts.ts
    │       ├── mangaOffline.ts
    │       ├── mangaProviders.ts
    │       ├── mangaZip.ts
    │       ├── mediaCache.ts
    │       ├── moodKeywords.ts
    │       ├── performance.ts
    │       ├── persistentState.ts
    │       ├── streamProviders.ts
    │       ├── supabase.ts
    │       ├── topRatedMedia.ts
    │       ├── trailerResolver.ts
    │       ├── useOfflineDetection.ts
    │       ├── useRetryWithBackoff.ts
    │       └── useWatchdog.ts
    │
    └── src-tauri/                   ← Tauri/Rust desktop shell (use THIS one, not root src-tauri/)
        ├── tauri.conf.json
        ├── Cargo.toml
        ├── src/
        │   ├── main.rs
        │   └── lib.rs
        └── capabilities/default.json
```

---

## 4. How the Pieces Connect

```
User clicks something
        ↓
React Page (e.g. MoviesPage.tsx)
        ↓
lib/api.ts → backendJson("/endpoint")   OR   lib/tmdb.ts → fetch TMDB directly
        ↓                                              ↓
FastAPI backend (127.0.0.1:8000)            TMDB API (external)
        ↓
app/routes/*.py  →  app/services/*.py
        ↓
SQLite DB (app/services/db_helpers.py)  |  yt-dlp/FFmpeg/aria2c  |  External APIs
```

### Key data flows:
- **Download flow:** `DownloaderPage` → `backendJson("/downloads", POST)` → `app/routes/downloads.py` → `downloads/engine.py` → yt-dlp / aria2c
- **Stream/watch flow:** `MediaPage` → `app/routes/providers.py` → `provider_adapters.py` → external stream providers → HLS URL → player components
- **Anime flow:** `app/routes/consumet.py` → Consumet API (self-hosted or public)
- **Manga flow:** `MangaPage` → `app/routes/manga.py` → `manga_mangadex.py` / `manga_anilist.py` etc.
- **Health check:** `App.tsx` polls `/health` every 2500ms → `RuntimeHealthContext` → `OfflineBanner` / `WatchdogBanner`
- **Settings:** `SettingsPage` → `backendJson("/settings")` → `settings_service.py` → `runtime-config.json`

---

## 5. Environment Variables & Configuration

### Backend env vars (set in shell or runtime-config.json)
| Variable | Purpose | Default |
|---|---|---|
| `GRABIX_BACKEND_PORT` | Backend port | `8000` |
| `GRABIX_TMDB_BEARER_TOKEN` | TMDB API token | — |
| `GRABIX_APP_STATE_ROOT` | Where DB + settings are stored | `~/Downloads/GRABIX` |
| `GRABIX_PACKAGED_MODE` | `1` = running as installed app | `0` (dev) |
| `GRABIX_DESKTOP_AUTH_TOKEN` | Auth token for desktop requests | — |

### Frontend env vars (set in `grabix-ui/.env`)
| Variable | Purpose |
|---|---|
| `VITE_GRABIX_API_BASE` | Backend URL (default: `http://127.0.0.1:8000`) |
| `VITE_TMDB_TOKEN` | TMDB Bearer token for direct browser calls |
| `VITE_TMDB_KEY` | TMDB API v3 key (alternative to Bearer token) |

---

## 6. Key Backend API Endpoints

| Route | Method | What it does |
|---|---|---|
| `/` | GET | Health check |
| `/health` | GET | Full service health report |
| `/health/capabilities` | GET | What features are available |
| `/diagnostics` | GET | Startup diagnostics |
| `/downloads` | GET | List all download jobs |
| `/downloads` | POST | Start a new download |
| `/downloads/{id}/pause` | POST | Pause a download |
| `/downloads/{id}/resume` | POST | Resume a download |
| `/downloads/{id}/cancel` | DELETE | Cancel a download |
| `/check-link` | GET | Validate a URL and get available formats |
| `/stream/...` | GET/POST | Stream proxy and HLS variant fetching |
| `/providers/status` | GET | Status of all stream providers |
| `/providers/resolve/movie` | POST | Resolve a movie stream URL |
| `/providers/resolve/tv` | POST | Resolve a TV episode stream URL |
| `/metadata/movie/{id}` | GET | TMDB movie details |
| `/metadata/tv/{id}` | GET | TMDB TV show details |
| `/manga/search` | GET | Search manga |
| `/manga/chapters/{id}` | GET | Get manga chapters |
| `/subtitles/...` | GET | Subtitle fetch |
| `/settings` | GET/POST | Read/write settings |
| `/moviebox/...` | GET | MovieBox content |

---

## 7. Coding Rules & Conventions

### Python (backend)
- All routes live in `app/routes/` — one file per feature area
- All business logic lives in `app/services/` — this is where db_helpers, streaming_helpers, and library_helpers now live
- Infrastructure helpers live in `core/`
- `backend/main.py` is the **real** entry point — `backend/core/main.py` is an old artifact, ignore it
- The three files at backend root (`db_helpers.py`, `streaming_helpers.py`, `library_helpers.py`) are **shims** — they just forward to `app/services/`. Do NOT add new logic to them
- Never add logic to `app/services/providers.py` — it is a re-export shim only
- Use `get_logger("name")` from `logging_utils.py` for all logging
- All DB ops go through `app/services/db_helpers.py` — never raw SQLite in route files
- `runtime_config.py` is the single source of truth for paths and env vars

### TypeScript / React (frontend)
- All pages are lazy-loaded in `App.tsx` via `lazy(() => import(...))`
- Navigation is done by setting the `page` state — never use React Router
- Custom navigation events: `window.dispatchEvent(new CustomEvent("grabix:navigate", { detail: { page } }))`
- Backend calls go through `backendJson()` or `backendFetch()` from `lib/api.ts`
- TMDB calls from browser use `lib/tmdb.ts` (falls back to backend if no env key)
- State management: React Context only — no Redux, no Zustand
- localStorage helpers: use `readJsonStorage()` / `writeJsonStorage()` from `lib/persistentState.ts`
- All pages are wrapped in `<ErrorBoundary>` in App.tsx
- Icons: use `Icons.tsx` only — `Icons_addition.tsx` has been deleted (merged May 2026)

---

## 8. Current Development Status

**Current Phase: Phase 4 — Streaming APIs**

Working on adding and stabilizing APIs for anime, manga, movies, and TV show streaming.

Completed:
- Phase 1 — Foundation (Tauri shell, FastAPI backend wiring)
- Phase 2 — Universal Downloader (yt-dlp, aria2c, download engine)
- Phase 3 — Anime, Manga, Movies & TV browsing
- Phase 4 — Provider system, stream resolvers, MovieBox integration

Structural cleanup done (May 2026):
- Moved `db_helpers.py`, `streaming_helpers.py`, `library_helpers.py` from backend root → `app/services/`
- Old locations now have compatibility shims (all existing imports still work)
- Merged `Icons_addition.tsx` into `Icons.tsx` — `Icons_addition.tsx` deleted
- Deleted empty `pages/VidSrcPlayer.tsx` (was an unused re-export shell)

Currently debugging: provider stream resolution, HLS playback stability, and various API integration issues.

---

## 9. Known Gotchas & Past Decisions

- **`backend/core/main.py` is NOT the entry point.** `backend/main.py` is. The `core/` folder was a Phase 2 refactor that split out infrastructure, but `core/main.py` is a leftover — it should be ignored.
- **The three root-level helpers are shims.** `backend/db_helpers.py`, `backend/streaming_helpers.py`, `backend/library_helpers.py` are now one-liner forwards to `app/services/`. The real code lives in `app/services/`. Do not put new code in the shims.
- **Port conflict:** If backend fails to start with "port already in use", another GRABIX process is running. Kill it first.
- **`providers.py`** in `app/services/` is ONLY a re-export shim — all actual provider logic is split across `provider_types.py`, `provider_registry.py`, `provider_adapters.py`, `provider_resolvers.py`, `provider_helpers.py`.
- **TMDB can be called from both browser AND backend** — browser calls use `VITE_TMDB_TOKEN`; backend calls use `GRABIX_TMDB_BEARER_TOKEN`. If the frontend token is not set, it proxies through the backend automatically.
- **Circuit breaker pattern** is used for stream providers — if a provider fails too many times, it is temporarily disabled. See `core/circuit_breaker.py` and `provider_registry.py`.
- **Supabase is optional** — only used if configured. The app works fully offline without it.
- **aria2c processes** are tracked in `download_controls` and automatically terminated on exit via `atexit`.
- **Adult content** is protected by bcrypt-hashed password stored in settings — requires bcrypt to be installed.
- **`downloads/engine.py` is 57KB** — it is oversized but intentionally not split yet. When touching it, be extra careful as many things depend on it.

---

## 10. How to Debug With AI Help

When you report an error, include:

1. **The exact error message** (full traceback if Python, full console error if JS)
2. **What you were doing** when it happened (which page, what action)
3. **Which files are most likely involved** (use the structure above to identify them)

### Quick file lookup by symptom:

| Symptom | Files to upload |
|---|---|
| Backend won't start | `backend/main.py`, `backend/app/services/runtime_config.py` |
| Download not starting | `backend/app/routes/downloads.py`, `backend/app/services/db_helpers.py` |
| Stream won't play / no sources | `backend/app/services/provider_adapters.py`, `provider_resolvers.py`, `grabix-ui/src/components/player/useSourceManager.ts` |
| HLS player broken | `grabix-ui/src/components/player/useHlsEngine.ts`, `usePlayerState.ts` |
| Manga not loading | `backend/app/routes/manga.py`, `backend/app/services/manga_mangadex.py` |
| TMDB data missing | `backend/app/services/tmdb.py`, `grabix-ui/src/lib/tmdb.ts` |
| Settings not saving | `backend/app/services/settings_service.py`, `grabix-ui/src/pages/SettingsPage.tsx` |
| Health check failing | `backend/core/health.py`, `grabix-ui/src/lib/api.ts` |
| Library not showing files | `backend/app/services/library_helpers.py`, `grabix-ui/src/pages/LibraryPage.tsx` |
| Auth/CORS errors | `backend/app/services/desktop_auth.py`, `backend/app/services/security.py` |
| Subtitles broken | `backend/app/routes/subtitles.py`, `backend/app/services/subtitles.py`, `grabix-ui/src/components/player/useSubtitleEngine.ts` |
| MovieBox not working | `backend/moviebox/moviebox_fetchers.py`, `backend/moviebox/routes.py` |

---

## 11. How to Update This File

After every significant debugging session or architectural change:

1. Update the **Current Development Status** section (Section 8)
2. Add any new gotchas to **Known Gotchas** (Section 9)
3. If new files were created, add them to the **File Structure** (Section 3)
4. If new env vars were added, update **Environment Variables** (Section 5)
5. If new API endpoints were added, update **Key Backend API Endpoints** (Section 6)

---

## 12. Loose Coupling Rules

This project had a "tight coupling" problem — files depended on each other in unpredictable ways, causing one fix to break three other things. These rules exist to stop that from getting worse, and to slowly make it better.

### What tight coupling looks like (avoid this)

```
# BAD — a route file reaching into another route's internals
from app.routes.downloads import _internal_helper

# BAD — a page doing everything itself (data fetch + state + UI in one 500-line file)
# MediaPage.tsx — 53KB, handles: API calls, local state, caching, rendering, modals

# BAD — two files importing each other (circular dependency)
# file_a.py imports from file_b.py
# file_b.py imports from file_a.py
```

### What loose coupling looks like (do this)

```
# GOOD — route files only import from services, never from each other
from app.services.db_helpers import get_db_connection
from app.services.settings_service import load_settings

# GOOD — a page file that is thin (under 10KB ideally)
# It calls a hook for data, a hook for state, and just renders UI
# Each concern lives in its own file

# GOOD — services only import from core, never from routes
from core.cache import get_cached
```

### The layer rule

Each layer is only allowed to talk to the layer directly below it:

```
Frontend Pages
      ↓  (calls only)
Frontend Hooks & Lib (api.ts, hooks/)
      ↓  (HTTP calls only)
Backend Routes (app/routes/)
      ↓  (calls only)
Backend Services (app/services/)
      ↓  (calls only)
Core Infrastructure (core/) + DB (db_helpers.py)
```

**A layer must never skip past its neighbor.** A page must not call the DB directly. A route must not call another route. A service must not import from a route.

### File size limits (warning signs)

| File type | Warning | Danger |
|---|---|---|
| Backend route file | > 200 lines | > 500 lines |
| Backend service file | > 300 lines | > 800 lines |
| Frontend page file | > 200 lines | > 500 lines |
| Frontend component | > 150 lines | > 300 lines |
| Frontend hook | > 100 lines | > 200 lines |

If a file is in the "danger" zone, it is doing too many jobs and will cause the "fix one, break three" problem.

### Rules for new code

1. **New backend logic goes in `app/services/`** — never directly in route files or `main.py`
2. **New frontend data-fetching goes in a hook** (`hooks/` or inline `use*.ts`) — never inline in a page component
3. **No circular imports** — if A imports B, then B must not import A
4. **One responsibility per file** — a file that "does downloads AND manages the queue AND tracks history" needs to be split
5. **Never import from a sibling route** — `downloads.py` must never import from `streaming.py`

---

## 13. Safe Bug-Fixing Protocol

This is the most important section. Following this protocol is what stops one fix from breaking three other things.

### Rule 1: One bug per conversation

Start a fresh conversation for each bug. Do not try to fix two bugs in the same chat. Claude has no memory between conversations — mixing two bugs causes it to confuse the context and make wrong assumptions.

### Rule 2: Name the files before touching them

Before asking Claude to write any code, ask this first:

> *"Before you change anything — which files will you need to touch to fix this? What else could break?"*

If Claude names more than 3-4 files, the bug is too big for one conversation. Break it into smaller pieces.

### Rule 3: Upload only the relevant files

Do not upload 50 files and say "here is my project, fix the bug." Upload only the files Claude said it needs. This forces surgical changes.

### Rule 4: Ask Claude to explain the change before making it

Ask: *"What exactly will you change, and why? What will stay the same?"*

If the explanation sounds like it touches things unrelated to your bug, stop and narrow the scope.

### Rule 5: Test immediately after each fix

After applying a fix, test only the thing that was fixed before moving on. If something else broke, that is now a separate bug — start a new conversation for it.

### The safe prompt template (copy-paste this)

```
I am working on GRABIX — a desktop app with a Python/FastAPI backend and a React/TypeScript frontend.

[Paste the relevant section of CLAUDE.md here if needed]

I have a specific bug:
- What I was doing: [describe the action]
- What happened: [describe the error or wrong behavior]
- The exact error message: [paste it]

Files I think are involved: [list 1-3 files]

Before writing any code:
1. Tell me which files you will touch
2. Tell me what could break
3. Tell me what you will NOT touch

Then make only the minimum change needed to fix this bug.
Give me the fixed files and tell me exactly where to put them.
After the fix, update CLAUDE.md if the change is significant.
```

---

## 14. Remaining Cleanup Roadmap

These are known problems that still need to be fixed. Each one is a separate conversation.

### Priority 1 — Split the oversized page files

Each of these pages is doing data fetching + state management + UI rendering all in one file. They need to be split into:
- A page shell file (thin, just renders layout)
- A data hook (`use[PageName]Data.ts`)
- Sub-components for each visual section

| File | Current size | Priority |
|---|---|---|
| `RatingsPage.tsx` | 65KB | High |
| `SettingsPage.tsx` | 55KB | High |
| `MangaPage.tsx` | 54KB | High |
| `MediaPage.tsx` | 53KB | High |
| `LibraryPage.tsx` | 45KB | Medium |
| `MovieBoxPage.tsx` | 39KB | Medium |
| `TVSeriesPage.tsx` | 37KB | Medium |
| `MoviesPage.tsx` | 37KB | Medium |

**How to do it (one page at a time):**
1. Start a new conversation
2. Upload only that page file
3. Ask Claude: "Split this page into: a thin shell, a data hook, and sub-components. Show me the plan before writing any code."
4. Review the plan, then apply it

### Priority 2 — Split `downloads/engine.py`

This file is 57KB and handles too many things. It needs to be split into at least:
- `engine_core.py` — the main download orchestration
- `engine_ytdlp.py` — yt-dlp specific logic
- `engine_aria2.py` — aria2c specific logic
- `engine_progress.py` — progress tracking and callbacks

Do this in a single dedicated conversation — upload only `downloads/engine.py` and `downloads/downloads_init.py`.

### Priority 3 — Resolve the two `main.py` situation

`backend/core/main.py` (23KB) and `backend/main.py` (26KB) both exist. The `core/main.py` is a historical leftover. A future conversation should:
1. Confirm which functions in `core/main.py` are NOT already in `backend/main.py`
2. Move any unique logic into the right service file
3. Delete `core/main.py`

### Priority 4 — Frontend API leakage

Some frontend `lib/` files call external APIs directly (TMDB, IMDb charts) instead of going through the backend. Over time these should be moved to the backend. Not urgent — the app works either way — but it means two places can break instead of one.

Files to eventually move:
- `lib/imdbCharts.ts` → new backend endpoint `/imdb/charts`
- `lib/topRatedMedia.ts` → new backend endpoint `/content/top-rated`

---

## 15. AI Instructions (Read This First)

**These rules apply to every conversation about this project:**

1. **Read this entire CLAUDE.md before touching any code.** Do not start writing until you understand where things live.

2. **State your plan before writing code.** Say which files you will touch and which you will not.

3. **Touch only what is necessary.** Do not "improve" unrelated code. Do not refactor things that are not broken. Do not add features that were not asked for.

4. **Match the existing style.** Do not change formatting, variable names, or patterns unless the bug requires it.

5. **Give the user fixed files with clear instructions.** After every code change, tell the user:
   - Which file to replace (exact path)
   - What you changed and why
   - What to test to confirm the fix worked

6. **Update this CLAUDE.md after every significant change.** If you move a file, rename something, add an endpoint, or make any structural change — update the relevant section of this file and give the user the updated CLAUDE.md to replace.

7. **Never try to fix multiple bugs in one conversation.** If the user asks to fix several things at once, do the most important one first and explain why the others need separate conversations.

8. **Flag oversized files.** If the user asks you to edit a file marked ⚠️ OVERSIZED in Section 3, warn them that the file is a high-risk area and get confirmation before proceeding.

9. **The layer rule is sacred.** Never suggest code that skips a layer (e.g. a page calling the DB directly, a route importing from another route). If the fix requires that, say so explicitly and propose a better path.

10. **Always give the user the fixed files, not just code snippets.** The user is not a programmer — they need complete files they can copy-paste and drop into place.
