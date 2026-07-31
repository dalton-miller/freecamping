# Free Camping Map — App

Offline-capable map app for browsing the free dispersed camping dataset
([`../data/sites.geojson`](../data/sites.geojson)). Built with Vite, vanilla
JavaScript, and [MapLibre GL JS](https://maplibre.org/).

## Setup

```sh
npm install
```

## Develop

```sh
npm run dev
```

This first copies the canonical dataset from `../data/sites.geojson` and the
region registry from `../data/regions.json` into `public/data/` (see "Syncing
data" below), then starts the Vite dev server.

## Build

```sh
npm run build
```

Outputs a static site to `dist/`. Preview it locally with `npm run preview`.

## Offline basemap tiles

Basemap coverage is organized by **region**. The registry of regions lives in
[`../data/regions.json`](../data/regions.json) (synced to
`public/data/regions.json`); each entry points at a hosted PMTiles archive
(~283MB for Missouri) that is **not committed to git** — it's too large for
GitHub. The archives are hosted on a Cloudflare R2 bucket; see
[`../docs/OFFLINE_TILES.md`](../docs/OFFLINE_TILES.md) for how to extract a
region with the `pmtiles` CLI, how it's hosted, and how to add a new region.

At runtime the app fetches `data/regions.json`, **auto-selects the basemap
whose bbox contains the current viewport center**, and lists each region in
the sidebar as a per-region **opt-in offline download**. If an archive is
unreachable (e.g. fresh dev checkout), the app warns and falls back to online
OSM raster tiles. There is no build-time tiles URL configuration —
`regions.json` is the single source of truth.

## PWA / offline support

The app is an installable PWA (configured via `vite-plugin-pwa` in
`vite.config.js`). The service worker:

- **Precaches** the app shell (built JS/CSS/HTML), icons,
  `data/sites.geojson`, and `data/regions.json`.
- **Serves `.pmtiles` archives from cache only when the user opted in.** A
  route matching any `.pmtiles` URL answers Range requests from Cache Storage
  if (and only if) the user previously clicked "Download for offline use" for
  that region in the sidebar (Workbox `createPartialResponse` turns the
  cached full response into 206 partials). Otherwise requests pass straight
  through to the network without caching — the multi-hundred-MB archives are
  never cached silently.
- **Runtime-caches** label glyphs from the Protomaps basemaps-assets CDN
  (CacheFirst) so place labels render offline after the first online load.

Once the service worker finishes precaching, a dismissible "Ready for offline
use" toast appears. After that point the app shell, markers, popups, and
filters work with no network connection; the basemap works offline for any
region the user explicitly downloaded. Note the first-ever load must be
online (glyphs are cached on first use).

Icons in `public/icons/` are generated placeholders; regenerate with
`npm run gen-icons`.

## Updating data offline-first

The dataset will grow over time, so the app uses a
stale-while-revalidate strategy for `sites.geojson` (implemented in
`src/data.js`):

1. On load, the app renders immediately from the best cached copy: an
   app-managed Cache Storage bucket (`mo-camping-data-v1`) first, then the
   service-worker precache / network.
2. In the background, if online, it fetches the latest `sites.geojson` (with
   a cache-busting query param so the request genuinely reaches the network)
   and compares it byte-for-byte with what's rendered.
3. If the data changed, the new copy is written to the app-managed cache and
   a dismissible "New data available — refresh to update" banner appears. The
   map is **not** swapped mid-session; the Refresh button reloads the page
   and renders the new data from cache.
4. Offline, the background check is skipped entirely.

### What a maintainer must do after editing the dataset

1. Edit `../data/sites.geojson`, validate it
   (`python ../scripts/validate_data.py --strict`).
2. Rebuild and redeploy the app (`npm run build` + deploy). The precache
   manifest is content-hash-based, so the new build automatically busts the
   service-worker cache — **no manual version bump is needed**. Users get the
   new data via the background check + refresh banner described above.

The one manual constant is the app-managed cache name `mo-camping-data-v1` in
`src/data.js`; it only needs bumping if the cache *format* ever changes
(unlikely — it stores the raw GeoJSON body).

## Deployment (GitHub Pages)

The app deploys to GitHub Pages via
[`../.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), which
runs on every push to `main` (and can be triggered manually from the Actions
tab). The workflow runs `npm ci && npm run build` in this directory and
publishes `dist/` with the official `actions/deploy-pages` action.

Key configuration:

- **Vite `base`** is set to `/freecamping/` in `vite.config.js` so
  asset URLs resolve under the Pages subpath. Override with the
  `VITE_BASE_PATH` env var if hosting at a domain root instead.
- **Basemap URLs come from `data/regions.json`** (synced into the build as
  `public/data/regions.json`) — there is no build-time `VITE_PMTILES_URL`
  env var anymore. The ~283MB-per-region archives are not in the repo; they
  are served from the R2 bucket, and `regions.json` is the single source of
  truth (see [`../docs/OFFLINE_TILES.md`](../docs/OFFLINE_TILES.md)).

### Initial go-live (completed)

The app is live at https://dalton-miller.github.io/freecamping/ with the
Missouri basemap served from the R2 bucket. The original go-live steps were:
push the repo to GitHub as `freecamping`, upload `missouri.pmtiles` to R2 and
register it in `data/regions.json`, enable GitHub Pages (GitHub Actions
source), deploy, and verify against the live URL.

### Verifying the deployed app

Verify against the **live URL** (not localhost):

1. Visit `https://dalton-miller.github.io/freecamping/` in a fresh
   browser profile. Confirm the map renders with the vector basemap, site
   markers appear, and clicking a marker shows the popup.
2. Exercise the sidebar: search by name, toggle land-manager / access /
   amenity checkboxes, and hit Reset — markers should update live.
3. Wait for the "Ready for offline use" toast, then use a region's
   "Download for offline use" button in the sidebar to cache its basemap.
4. Test offline mode: in Chrome DevTools → Network, set throttling to
   **Offline**, then reload the page. The app shell, markers, popups, and
   filters should all still work, and the basemap should render for the
   downloaded region with no successful network requests beyond the service
   worker cache.
5. Confirm the app is installable (browser "Install app" prompt / Add to
   Home Screen on mobile) and launches standalone.

## Syncing data

The app reads its site data from `public/data/sites.geojson` and its region
registry from `public/data/regions.json`. Those files are **copies** of the
canonical data at the repo root (`data/sites.geojson`, `data/regions.json`),
kept in sync by:

```sh
npm run sync-data
```

`sync-data` runs automatically before `npm run dev` and `npm run build` (via
npm `pre` hooks), so you normally don't need to run it by hand. If you edit
the root dataset or region registry, re-run dev/build (or
`npm run sync-data`) to pick up the changes. The copied files under
`public/` should not be edited directly.

## Features

- Offline-first basemaps: per-region PMTiles vector tiles registered in
  `data/regions.json`, auto-selected by viewport center, with a graceful
  fallback to online OSM raster tiles when an archive isn't present (e.g.
  fresh dev checkout). See "Offline basemap tiles".
- Per-region opt-in offline basemap downloads in the sidebar, so the
  multi-hundred-MB archives are never cached silently.
- Installable PWA with offline support after first load, including a
  "Ready for offline use" indicator and a "New data available — refresh to
  update" prompt (see "Updating data offline-first").
- Every site in the dataset rendered as a circle marker, colored by land
  manager (green = Mark Twain National Forest, blue = Missouri Department of
  Conservation).
- Click a marker for a popup with the site's details (missing optional fields
  are omitted gracefully).
- Sidebar with name search plus checkbox filters for land manager, access,
  and amenities (AND across categories, OR within a category). The sidebar
  collapses to a toggle button on viewports under 600px wide.
