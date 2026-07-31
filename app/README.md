# MO Dispersed Camping — App

Offline-capable map app for browsing the Missouri dispersed camping dataset
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

This first copies the canonical dataset from `../data/sites.geojson` into
`public/data/sites.geojson` (see "Syncing data" below), then starts the Vite
dev server.

## Build

```sh
npm run build
```

Outputs a static site to `dist/`. Preview it locally with `npm run preview`.

## Offline basemap tiles

The basemap is a Missouri-extent PMTiles archive (`public/tiles/missouri.pmtiles`,
~283MB) that is **not committed to git** — it's too large for GitHub. See
[`../docs/OFFLINE_TILES.md`](../docs/OFFLINE_TILES.md) for how to regenerate it
with the `pmtiles` CLI and how it's hosted (GitHub Release asset). For local
dev, drop the file into `public/tiles/`; if it's missing, the app warns and
falls back to online OSM raster tiles. For deployed builds, point the app at
the hosted file with the `VITE_PMTILES_URL` build-time env var.

## PWA / offline support

The app is an installable PWA (configured via `vite-plugin-pwa` in
`vite.config.js`). The service worker:

- **Precaches** the app shell (built JS/CSS/HTML), icons, and
  `data/sites.geojson`.
- **Runtime-caches** `missouri.pmtiles` with a `CacheFirst` strategy plus
  Workbox's `rangeRequests` plugin. The pmtiles library reads the archive via
  HTTP Range requests rather than one big download, so precaching it
  wholesale would be wrong (multi-hundred-MB upfront download, and precache
  doesn't honor Range requests); the runtime strategy caches the archive on
  first use and serves later 206 partial responses from cache.
- **Runtime-caches** label glyphs from the Protomaps basemaps-assets CDN
  (CacheFirst) so place labels render offline after the first online load.

Once the service worker finishes precaching, a dismissible "Ready for offline
use" toast appears. After that point the app — map, base tiles, markers,
popups, filters — works with no network connection. Note the first-ever load
must be online (the basemap archive and glyphs are cached on first use).

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

- **Vite `base`** is set to `/mo-dispersed-camping/` in `vite.config.js` so
  asset URLs resolve under the Pages subpath. Override with the
  `VITE_BASE_PATH` env var if hosting at a domain root instead.
- **`VITE_PMTILES_URL`** is set in the workflow to the externally hosted
  `missouri.pmtiles` Release-asset URL — the ~283MB archive is not in the
  repo, so a deployed build must point at the hosted copy (see
  [`../docs/OFFLINE_TILES.md`](../docs/OFFLINE_TILES.md)).

### Remaining manual steps to go live

The workflow is ready but deployment itself requires pushing to GitHub:

1. Push this repo to GitHub as `mo-dispersed-camping`.
2. Upload `public/tiles/missouri.pmtiles` as a Release asset (tag
   `tiles-v1`) per [`../docs/OFFLINE_TILES.md`](../docs/OFFLINE_TILES.md).
3. Edit `deploy.yml`: replace `<owner>` in `VITE_PMTILES_URL` with the
   GitHub user/org.
4. In repo Settings → Pages, set Source to **GitHub Actions**.
5. Push to `main` (or run the workflow manually) to deploy.
6. Replace `<owner>` in the live-URL link at the top of the root
   [`../README.md`](../README.md) with the real URL.

### Verifying the deployed app

After the first successful deploy, verify against the **live URL** (not
localhost):

1. Visit `https://<owner>.github.io/mo-dispersed-camping/` in a fresh
   browser profile. Confirm the map renders with the vector basemap, site
   markers appear, and clicking a marker shows the popup.
2. Exercise the sidebar: search by name, toggle land-manager / access /
   amenity checkboxes, and hit Reset — markers should update live.
3. Wait for the "Ready for offline use" toast (the basemap archive caches
   on first use, so pan/zoom around Missouri once).
4. Test offline mode: in Chrome DevTools → Network, set throttling to
   **Offline**, then reload the page. The map, base tiles, markers, popups,
   and filters should all still work with no successful network requests
   beyond the service worker cache.
5. Confirm the app is installable (browser "Install app" prompt / Add to
   Home Screen on mobile) and launches standalone.

## Syncing data

The app reads its site data from `public/data/sites.geojson`. That file is a
**copy** of the canonical dataset at the repo root (`data/sites.geojson`),
kept in sync by:

```sh
npm run sync-data
```

`sync-data` runs automatically before `npm run dev` and `npm run build` (via
npm `pre` hooks), so you normally don't need to run it by hand. If you edit
the root dataset, re-run dev/build (or `npm run sync-data`) to pick up the
changes. The copied file under `public/` should not be edited directly.

## Features

- Offline-first basemap: Missouri PMTiles vector tiles (see "Offline
  basemap tiles"), with a graceful fallback to online OSM raster tiles when
  the archive isn't present (e.g. fresh dev checkout).
- Installable PWA with full offline support after first load, including a
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
