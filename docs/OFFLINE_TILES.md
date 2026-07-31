# Offline Vector Tiles (PMTiles) for Missouri

The app uses a [PMTiles](https://github.com/protomaps/PMTiles) archive of the
Protomaps basemap, clipped to Missouri, so the basemap works fully offline.
This document describes exactly how the archive was produced and how to
regenerate or re-host it.

## What we ship

- **Source:** Protomaps daily basemap build `20260730.pmtiles` (full planet,
  ~120GB), fetched from `https://build.protomaps.com/`. The list of available
  builds is published at `https://build-metadata.protomaps.dev/builds.json`.
- **Extent:** Missouri bounding box `[-95.9, 35.9, -89.0, 40.7]`
  (minLon, minLat, maxLon, maxLat) — a loose sanity-check box around the
  state, matching the one in `scripts/validate_data.py`.
- **Zoom range:** z0–z14 (chosen to keep the file near the ~300MB target
  while still showing road-level detail; z15 would roughly quadruple the
  size).
- **Result:** `missouri.pmtiles`, **283MB**, 117,805 tiles, MVT/gzip,
  PMTiles spec v3.

## Regenerating the archive

These are the exact commands that were run (macOS arm64):

```sh
# 1. Install the pmtiles CLI (prebuilt release binary; `go install
#    github.com/protomaps/go-pmtiles/pmtiles@latest` also works when the
#    module layout allows it — verify with `pmtiles version`).
curl -sL -o pmtiles.zip \
  https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles-1.31.2_Darwin_arm64.zip
unzip pmtiles.zip && mv pmtiles ~/.local/bin/

# 2. Find the latest available basemap build:
curl -s https://build-metadata.protomaps.dev/builds.json | grep -oE '"key":"[0-9]{8}\.pmtiles"' | tail -1

# 3. Extract the Missouri extent. pmtiles reads the remote archive with HTTP
#    Range requests, so you do NOT download the full ~120GB planet file —
#    this transferred ~300MB total and took ~20 seconds.
pmtiles extract https://build.protomaps.com/20260730.pmtiles missouri.pmtiles \
  --bbox=-95.9,35.9,-89.0,40.7 --maxzoom=14

# 4. Verify the result:
pmtiles show missouri.pmtiles
# Expect: bounds (-95.9, 35.9)-(-89.0, 40.7), min zoom 0, max zoom 14,
# tile type mvt.

# 5. Place it where the dev server / build can serve it:
mv missouri.pmtiles app/public/tiles/missouri.pmtiles
```

## Hosting decision: NOT committed to git

At 283MB the extract exceeds GitHub's 100MB per-file limit, so it is **not
committed** (`app/public/tiles/*.pmtiles` is gitignored). Options:

- **Git LFS** — works, but LFS bandwidth/storage quotas on the free tier are
  small and every clone pays the cost.
- **GitHub Release asset** — release assets may be up to 2GB each and don't
  bloat the repo. Upload with:

  ```sh
  gh release create tiles-v1 app/public/tiles/missouri.pmtiles \
    --title "Offline basemap tiles" --notes "Missouri z0-14 Protomaps extract"
  ```

  ⚠️ Release assets are served from `release-assets.githubusercontent.com`,
  which sends **no CORS headers** — browsers block cross-origin range
  requests, so this URL cannot be used directly by the app. (A `tiles-v1`
  asset exists in this repo as a backup copy only.)
- **Cloudflare R2 (chosen)** — the archive is hosted at
  `https://pub-5df54feec81641f48132b421f8132620.r2.dev/pmtiles/missouri.pmtiles`
  (public `r2.dev` bucket URL, free tier). Range requests work natively; a
  bucket CORS policy allows `GET`/`HEAD` with the `Range` header from
  `https://dalton-miller.github.io` and exposes `Content-Range`/`Accept-Ranges`.

## How the app consumes it

`app/src/map.js` has a single configurable constant:

```js
const PMTILES_URL =
  import.meta.env.VITE_PMTILES_URL || `${import.meta.env.BASE_URL}tiles/missouri.pmtiles`;
```

- **Local dev:** put `missouri.pmtiles` in `app/public/tiles/` (step 5 above)
  and nothing else is needed.
- **Deployed builds:** set `VITE_PMTILES_URL` to the Release-asset URL at
  build time (e.g. in the GitHub Actions deploy workflow), since the file
  isn't in the repo.

If the archive is unreachable (e.g. dev before generating tiles), the app
logs a warning and falls back to online OSM raster tiles so development can
continue.

## Offline caching behavior — opt-in download

At ~283MB the basemap is far too big to cache silently, so offline use is
**opt-in**: the user clicks "Download for offline use" in the sidebar
(`app/src/offline.js`), which fetches the full archive (with progress and
cancel) and writes it to the `mo-basemap-tiles` Cache Storage bucket.

The service worker (`app/src/sw.js`, Workbox injectManifest) never caches the
archive on its own. Its route for `missouri.pmtiles` serves Range requests
from the cache **only if the user downloaded it** (Workbox
`createPartialResponse` turns the cached full response into 206 partials),
and otherwise passes straight through to the network without caching. Casual
visitors therefore never pull the big file; tiles stream on demand over the
network while online.

Label glyphs (not stored in PMTiles archives) are fetched from the Protomaps
basemaps-assets CDN and runtime-cached CacheFirst, so labels keep working
offline after the first online load.
