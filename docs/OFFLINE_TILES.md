# Offline Vector Tiles (PMTiles) by Region

The app uses [PMTiles](https://github.com/protomaps/PMTiles) archives of the
Protomaps basemap, clipped to one region at a time, so the basemap works
fully offline. Each region is registered in [`data/regions.json`](../data/regions.json)
with its id, name, bounding box, hosted PMTiles URL, and file size. This
document describes how the archives are produced, where they are hosted, and
how to add a new region.

## What we ship (per region)

Each region entry in `data/regions.json` points at a single `.pmtiles` file:

- **Source:** a Protomaps daily basemap build (full planet, ~120GB), fetched
  from `https://build.protomaps.com/`. The list of available builds is
  published at `https://build-metadata.protomaps.dev/builds.json`.
- **Extent:** the region's bbox `[minLon, minLat, maxLon, maxLat]` — a loose
  sanity-check box around the region, matching the one the validator uses in
  `scripts/validate_data.py`.
- **Zoom range:** z0–z14 (chosen to keep each file near the ~300MB target
  while still showing road-level detail; z15 would roughly quadruple the
  size).
- **Naming:** the file is named `<region-id>.pmtiles`, where `<region-id>`
  matches the `id` field in `data/regions.json` (e.g. `missouri.pmtiles`).

The current Missouri extract is **283MB**, 117,805 tiles, MVT/gzip, PMTiles
spec v3, produced from build `20260730.pmtiles` with bbox
`[-95.9, 35.9, -89.0, 40.7]`.

## Adding a new region

The repo owner does this manually per region. `pmtiles` reads the remote
planet archive with HTTP Range requests, so you never download the full
~120GB file — an extract transfers roughly the size of the result and takes
seconds.

1. **Find the latest Protomaps basemap build:**

   ```sh
   curl -s https://build-metadata.protomaps.dev/builds.json | grep -oE '"key":"[0-9]{8}\.pmtiles"' | tail -1
   ```

2. **Install the pmtiles CLI** (once). Prebuilt release binary; `go install
   github.com/protomaps/go-pmtiles/pmtiles@latest` also works when the module
   layout allows it — verify with `pmtiles version`:

   ```sh
   curl -sL -o pmtiles.zip \
     https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles-1.31.2_Darwin_arm64.zip
   unzip pmtiles.zip && mv pmtiles ~/.local/bin/
   ```

3. **Extract the region.** Use the region's bbox and `--maxzoom=14`, and
   name the output `<region-id>.pmtiles`:

   ```sh
   pmtiles extract https://build.protomaps.com/<build>.pmtiles <region-id>.pmtiles \
     --bbox=<minLon>,<minLat>,<maxLon>,<maxLat> --maxzoom=14
   ```

   Verify the result with `pmtiles show <region-id>.pmtiles` — expect bounds
   matching your bbox, min zoom 0, max zoom 14, tile type mvt.

4. **Upload to the R2 bucket** at the key `pmtiles/<region-id>.pmtiles`. The
   existing bucket is served publicly at
   `https://pub-5df54feec81641f48132b421f8132620.r2.dev/` and CORS is already
   configured (see "Hosting decision" below), so the file is immediately
   usable at
   `https://pub-5df54feec81641f48132b421f8132620.r2.dev/pmtiles/<region-id>.pmtiles`.

5. **Add the entry to `data/regions.json`** with `id`, `name`, `bbox`
   (`[minLon, minLat, maxLon, maxLat]`), `pmtiles_url`, and `size_bytes`.
   Get `size_bytes` from the hosted file's Content-Length:

   ```sh
   curl -sI https://pub-5df54feec81641f48132b421f8132620.r2.dev/pmtiles/<region-id>.pmtiles | grep -i content-length
   ```

6. **Add campsites** within the region's bbox to `data/sites.geojson` (see
   [`CONTRIBUTING.md`](CONTRIBUTING.md)). The validator requires every site
   to fall inside at least one registered region's bbox.

7. **Validate:**

   ```sh
   /usr/bin/python3 scripts/validate_data.py --strict
   ```

8. **Commit.** The app's sync script copies `data/regions.json` into the app
   automatically on dev/build, and CI deploys from `main` — no further app
   changes are needed.

## Example: regenerating the Missouri archive

These are the exact commands that produced the current Missouri file
(macOS arm64):

```sh
# 1. Latest build at the time: 20260730.pmtiles
curl -s https://build-metadata.protomaps.dev/builds.json | grep -oE '"key":"[0-9]{8}\.pmtiles"' | tail -1

# 2. Extract the Missouri extent. This transferred ~300MB total and took
#    ~20 seconds.
pmtiles extract https://build.protomaps.com/20260730.pmtiles missouri.pmtiles \
  --bbox=-95.9,35.9,-89.0,40.7 --maxzoom=14

# 3. Verify the result:
pmtiles show missouri.pmtiles
# Expect: bounds (-95.9, 35.9)-(-89.0, 40.7), min zoom 0, max zoom 14,
# tile type mvt.
```

## Hosting decision: NOT committed to git

At ~283MB each, the extracts exceed GitHub's 100MB per-file limit, so they
are **not committed** (`app/public/tiles/*.pmtiles` is gitignored). Options:

- **Git LFS** — works, but LFS bandwidth/storage quotas on the free tier are
  small and every clone pays the cost.
- **GitHub Release asset** — release assets may be up to 2GB each and don't
  bloat the repo. ⚠️ However, release assets are served from
  `release-assets.githubusercontent.com`, which sends **no CORS headers** —
  browsers block cross-origin range requests, so this URL cannot be used
  directly by the app. (A `tiles-v1` asset exists in this repo as a backup
  copy of the Missouri file only.)
- **Cloudflare R2 (chosen)** — the archives are hosted on a public `r2.dev`
  bucket (free tier) at
  `https://pub-5df54feec81641f48132b421f8132620.r2.dev/pmtiles/<region-id>.pmtiles`.
  Range requests work natively; a bucket CORS policy allows `GET`/`HEAD`
  with the `Range` header from `https://dalton-miller.github.io` and exposes
  `Content-Range`/`Accept-Ranges`.

## How the app consumes the archives

`data/regions.json` is the single source of truth. The app's sync script
copies it to `app/public/data/regions.json` on dev/build; at runtime the app
fetches it, picks the basemap archive whose bbox contains the current
viewport center, and lists each region in the sidebar as an opt-in offline
download.

If an archive is unreachable (e.g. dev before generating tiles), the app
logs a warning and falls back to online OSM raster tiles so development can
continue.

## Offline caching behavior — opt-in download

At ~283MB each the basemaps are far too big to cache silently, so offline
use is **opt-in**: the user clicks "Download for offline use" next to a
region in the sidebar (`app/src/offline.js`), which fetches that region's
full archive (with progress and cancel) and writes it to Cache Storage.

The service worker (`app/src/sw.js`, Workbox injectManifest) never caches
any archive on its own. Its route matches **any `.pmtiles` URL** (not just
Missouri's) and serves Range requests from the cache **only if the user
downloaded that archive** (Workbox `createPartialResponse` turns the cached
full response into 206 partials); otherwise it passes straight through to
the network without caching. Casual visitors therefore never pull the big
files; tiles stream on demand over the network while online.

Label glyphs (not stored in PMTiles archives) are fetched from the Protomaps
basemaps-assets CDN and runtime-cached CacheFirst, so labels keep working
offline after the first online load.
