# Build Plan: Missouri Dispersed Camping Dataset + Offline Map SPA

**Project goal:** Build an open-source dataset of dispersed/free camping locations on Missouri public land (Mark Twain National Forest, MDC conservation areas), plus an installable, offline-capable Progressive Web App (PWA) to browse it on a map.

**How to use this doc:** Each task below is scoped to be handed to Qwen as a single prompt. Work through phases in order — later tasks assume earlier ones exist. Copy the "Prompt for Qwen" block verbatim (edit paths/names as needed), and use the acceptance criteria to verify the output before moving to the next task. Feed Qwen the relevant existing files as context on each new prompt (most coding agents can read the repo directly, but if not, paste in the file contents referenced).

---

## Phase 0 — Repo Scaffolding

### Task 0.1 — Initialize repository structure

**Description:** Set up the base repo layout separating the dataset from the app, so each can be consumed independently.

**Acceptance criteria:**
- Repo has this top-level structure:
  ```
  /data/
    sites.geojson
    schema.json
    photos/
  /scripts/
    geojson_to_gpx.py
    validate_data.py
  /app/
    (SPA source, added in Phase 2)
  /docs/
    CONTRIBUTING.md
    DATA_SCHEMA.md
  README.md
  LICENSE
  ```
- `README.md` explains the project in 3-4 sentences, links to the dataset and the app, and states the license.
- `LICENSE` is present — use ODbL or CC-BY 4.0 for the dataset (not MIT, since MIT isn't designed for data) and MIT or Apache 2.0 for the app code. Document this split explicitly in the README since two licenses apply to different parts of the repo.
- Empty `sites.geojson` is a valid empty `FeatureCollection`.

**Prompt for Qwen:**
```
Create a new git repository for an open-source project called "mo-dispersed-camping". 
It will contain (1) a GeoJSON dataset of free dispersed camping locations on public 
land in Missouri, and (2) a static web app to browse it offline.

Set up this folder structure:
/data/sites.geojson (valid empty GeoJSON FeatureCollection)
/data/schema.json (empty placeholder for now)
/data/photos/ (empty folder with .gitkeep)
/scripts/ (empty folder with .gitkeep)
/app/ (empty folder with .gitkeep)
/docs/CONTRIBUTING.md (placeholder heading only)
/docs/DATA_SCHEMA.md (placeholder heading only)
README.md — explain the project's purpose in 3-4 sentences, note it covers Mark Twain 
National Forest and Missouri Department of Conservation land, and that it ships both 
a dataset and an offline map app.
LICENSE — dual license: dataset under ODbL 1.0, app code under MIT. Explain the split 
clearly in the README.

Output the full file tree and contents of each file.
```

---

## Phase 1 — Dataset

### Task 1.1 — Define the data schema

**Description:** Lock down the GeoJSON `properties` schema before entering any data, so every record is consistent.

**Acceptance criteria:**
- `data/schema.json` is a valid JSON Schema (draft-07 or later) describing the `properties` object for a site Feature.
- Required fields: `id` (string, stable unique slug), `name` (string), `land_manager` (enum: `"Mark Twain National Forest"`, `"Missouri Department of Conservation"`, `"Other"`), `access` (enum: `"paved"`, `"gravel"`, `"high_clearance_recommended"`, `"4wd_recommended"`), `last_verified` (date string, ISO 8601 — date the entry was last reviewed against its source, not a guarantee of on-the-ground accuracy; uncertainty belongs in `notes`/`source`).
- Optional fields: `description` (string), `fire_restrictions` (string), `amenities` (array of enum strings, e.g. `"vault_toilet"`, `"fire_ring"`, `"water_nearby"`), `cell_signal` (enum: `"none"`, `"weak"`, `"good"`), `rig_size_limit_ft` (number or null), `photos` (array of relative or absolute URL strings), `source` (string — where this entry came from, e.g. forum thread URL, personal visit), `notes` (string).
- `docs/DATA_SCHEMA.md` documents every field in a table (name, type, required?, description, example value) generated from/matching the schema.
- A sample Feature validating against the schema is included in the doc as an example.

**Prompt for Qwen:**
```
In the mo-dispersed-camping repo, create /data/schema.json as a JSON Schema (draft-07) 
describing the "properties" object of a GeoJSON Feature representing one dispersed 
camping site. 

Required fields:
- id: string, stable unique slug (e.g. "noblett-lake-below-dam")
- name: string
- land_manager: enum ["Mark Twain National Forest", "Missouri Department of Conservation", "Other"]
- access: enum ["paved", "gravel", "high_clearance_recommended", "4wd_recommended"]
- last_verified: string, ISO 8601 date the entry was last reviewed against its source

Optional fields:
- description: string
- fire_restrictions: string
- amenities: array of enum ["vault_toilet", "fire_ring", "water_nearby", "trash_service", "picnic_table"]
- cell_signal: enum ["none", "weak", "good"]
- rig_size_limit_ft: number or null
- photos: array of strings (relative paths or URLs)
- source: string
- notes: string

Then write /docs/DATA_SCHEMA.md documenting every field in a markdown table (name, type, 
required, description, example), plus one complete example GeoJSON Feature at the bottom 
that validates against the schema, using "Noblett Lake Dispersed Site" as example data 
(Mark Twain National Forest, paved access, vault toilet, fire rings established-only).
```

---

### Task 1.2 — Build the validation script

**Description:** A script to check `sites.geojson` against `schema.json` so bad data can't get merged.

**Acceptance criteria:**
- `scripts/validate_data.py` takes no arguments, reads `data/sites.geojson` and `data/schema.json`, and validates every Feature's `properties` against the schema.
- Also validates: `geometry.type == "Point"`, coordinates are `[lon, lat]` order, latitude within roughly 35.9–40.7 and longitude within roughly -95.9–-89.0 (Missouri's bounding box, as a sanity check, with a comment explaining it's a loose bounding box not an exact state boundary).
- Also validates: every `id` is unique across the file.
- Exits with non-zero status and prints a clear list of errors (feature index + field + problem) if anything fails; exits 0 and prints "All N features valid" on success.
- Uses `jsonschema` package; script has a `requirements.txt` or documented `pip install` line.
- Includes a `--strict` flag that also warns (not fails) on missing optional-but-recommended fields like `photos` or `description`.

**Prompt for Qwen:**
```
In the mo-dispersed-camping repo, write /scripts/validate_data.py (Python 3) that:

1. Loads /data/sites.geojson and /data/schema.json
2. Validates it's a valid GeoJSON FeatureCollection
3. Validates every Feature's "properties" object against schema.json using the jsonschema package
4. Checks geometry.type == "Point" for every feature
5. Checks coordinates are within Missouri's rough bounding box: longitude between -95.9 
   and -89.0, latitude between 35.9 and 40.7 (add a comment noting this is a loose 
   sanity-check box, not an exact boundary, so border areas are fine)
6. Checks every properties.id is unique across the whole file
7. On any failure: print a clear list of problems (feature index, field, issue) and 
   exit with status 1
8. On success: print "All N features valid" and exit 0
9. Add a --strict flag that additionally warns (prints but doesn't fail) if a feature 
   is missing "photos" or "description"

Also create /scripts/requirements.txt listing jsonschema.
Add a short section to the root README.md under a "## Validating data" heading explaining 
how to run: pip install -r scripts/requirements.txt && python scripts/validate_data.py
```

---

### Task 1.3 — Populate initial dataset entries

**Description:** Seed the dataset with the known sites already surfaced from research (Noblett Lake, Ozark Trail corridor sites, etc.) so there's real data to build the app against.

**Acceptance criteria:**
- At least 8-10 Feature entries in `data/sites.geojson`, covering a mix of Mark Twain National Forest dispersed sites and at least one MDC conservation area, with realistic (approximate, publicly-known) coordinates.
- Every entry passes `validate_data.py --strict` with zero errors (warnings for missing photos are acceptable at this stage since no photos exist yet).
- Each entry has a real, honest `source` field (e.g. link to the Forest Service recreation page, or "overlandbound.com forum thread, unverified" where accuracy isn't confirmed). `last_verified` means "date this entry was last reviewed against its source" — always set it, but flag any location uncertainty honestly in `notes`/`source`.
- Include a couple of `notes` fields flagging genuine uncertainty (e.g. "Exact pull-off location approximate — confirm on-site with MVUM map before relying on this.").

**Prompt for Qwen:**
```
In the mo-dispersed-camping repo, populate /data/sites.geojson with 8-10 real dispersed 
camping site entries for Missouri, following the schema in /data/schema.json. Base entries 
on publicly known locations such as:
- Noblett Lake area, Mark Twain National Forest (dispersed sites below the dam, near the 
  developed campground)
- Sites along the Ozark Trail corridor within Mark Twain National Forest (note: camping is 
  generally allowed 100 feet from trail/water, so represent these as trailhead-adjacent 
  areas, not exact pinpointed spots, and say so in "notes")
- At least one Missouri Department of Conservation conservation area known to allow 
  dispersed/primitive camping

For each entry:
- Use approximate real-world coordinates for the named area (acceptable to be 
  approximate — note this honestly in "notes" where precision is uncertain)
- Fill "source" honestly — link to the Forest Service page, MDC page, or note 
  "community-reported, unverified" if it's from a forum discussion
- Always set "last_verified" to the date you reviewed the entry (it records review, 
  not confirmation); record any uncertainty about exact location in "notes"
- Leave "photos" as an empty array for now

After writing the file, run (or simulate running) /scripts/validate_data.py --strict 
against it and report the result. Fix any validation errors before finishing.
```

---

### Task 1.4 — GeoJSON → GPX export script

**Description:** Generate a GPX file from the canonical GeoJSON so GPS apps (OsmAnd, Gaia, etc.) can import it directly.

**Acceptance criteria:**
- `scripts/geojson_to_gpx.py` reads `data/sites.geojson`, writes `data/sites.gpx`.
- Each GeoJSON Feature becomes a `<wpt>` with `lat`/`lon` from geometry, `<name>` from `properties.name`, `<desc>` built by concatenating land_manager, access, amenities, fire_restrictions, and cell_signal into a readable one-line summary.
- If `photos` is non-empty, add a `<link href="...">` element for the first photo.
- Output GPX validates against the GPX 1.1 XSD (script should note this, doesn't need to bundle the XSD, but structure should be schema-correct: `<gpx>` root with proper namespace, `version="1.1"`, `creator` attribute set).
- Script runnable as `python scripts/geojson_to_gpx.py` with no arguments, prints how many waypoints were written.
- README updated with a "Getting the data" section explaining both the GeoJSON (rich/canonical) and GPX (portable) options, and how to regenerate GPX after editing the GeoJSON.

**Prompt for Qwen:**
```
In the mo-dispersed-camping repo, write /scripts/geojson_to_gpx.py (Python 3, stdlib only 
— no extra dependencies) that:

1. Reads /data/sites.geojson
2. Writes /data/sites.gpx in valid GPX 1.1 format (root <gpx> element with correct 
   xmlns="http://www.topografix.com/GPX/1/1", version="1.1", creator="mo-dispersed-camping")
3. For each GeoJSON Feature, writes one <wpt lat="..." lon="..."> with:
   - <name> from properties.name
   - <desc> built from a readable one-line summary combining land_manager, access, 
     amenities (comma-joined), fire_restrictions, and cell_signal — skip any field 
     that's missing/empty
   - If properties.photos is non-empty, add <link href="first photo url"><text>Photo</text></link>
4. Prints "Wrote N waypoints to data/sites.gpx" when done

Then add a "## Getting the data" section to README.md explaining:
- data/sites.geojson is the canonical, richest source (use this for the app or if 
  your tool supports GeoJSON)
- data/sites.gpx is a portable export for GPS apps like OsmAnd, Gaia GPS, Garmin devices
- To regenerate the GPX after editing the GeoJSON, run: python scripts/geojson_to_gpx.py
```

---

### Task 1.5 — Contribution guidelines

**Description:** Docs so other people can add sites via pull request without breaking the schema.

**Acceptance criteria:**
- `docs/CONTRIBUTING.md` covers: how to add a new site (edit sites.geojson directly, following schema.json), how to run validation before submitting a PR, expectations around honesty/accuracy (don't guess coordinates, mark uncertain entries clearly, cite a source), a note on Leave No Trace / not creating new impact by publicizing sensitive/fragile locations, and photo submission process (where to put image files, size/format expectations, e.g. resize to under ~1MB, jpg/png only).
- Includes a PR checklist (markdown checkboxes) contributors can copy into their PR description.

**Prompt for Qwen:**
```
In the mo-dispersed-camping repo, write /docs/CONTRIBUTING.md covering:

1. How to add a new site: edit data/sites.geojson directly following the schema in 
   data/schema.json (link to docs/DATA_SCHEMA.md)
2. Run `python scripts/validate_data.py --strict` before opening a PR and paste the 
   output into the PR description
3. Accuracy expectations: don't guess coordinates from memory — use a map to confirm, 
   cite a source (forum thread, agency page, personal visit) in the "source" field, 
   and if you're not fully confident in a location, say so explicitly in "notes" rather 
   than omitting the caveat
4. A short Leave No Trace note: avoid adding hyper-specific coordinates for fragile or 
   already-overused sites; general area + access description is often more responsible 
   than an exact pin
5. Photo contributions: place images in /data/photos/<site-id>/, keep them under ~1MB, 
   jpg or png only, reference the relative path in the site's "photos" array
6. A markdown PR checklist at the bottom contributors can copy-paste, e.g.:
   - [ ] Ran validate_data.py --strict with no errors
   - [ ] Coordinates confirmed on a map, not guessed
   - [ ] Source cited
   - [ ] Uncertain details noted honestly
   - [ ] Photos under 1MB and placed in correct folder
```

---

## Phase 2 — SPA Scaffolding

### Task 2.1 — Initialize the app project

**Description:** Set up a Vite + vanilla JS (or React, your call — recommend vanilla JS + MapLibre for simplicity, no framework overhead needed for this scope) project inside `/app`.

**Acceptance criteria:**
- `/app` contains a working Vite project (`npm create vite@latest`) with `maplibre-gl` installed as a dependency.
- `npm run dev` serves a page showing a MapLibre map centered on Missouri (roughly lat 38.5, lon -92.5, zoom 6) using a free/open basemap style for now (e.g. OSM raster tiles via a simple style — this gets replaced with offline PMTiles in Phase 3).
- `npm run build` produces a working static build in `/app/dist`.
- Basic project structure: `src/main.js`, `src/map.js`, `index.html`, `src/style.css`.
- README in `/app` explaining `npm install`, `npm run dev`, `npm run build`.

**Prompt for Qwen:**
```
Inside the mo-dispersed-camping repo, in the /app folder, scaffold a new Vite project 
using vanilla JavaScript (no framework) with maplibre-gl as a dependency.

Requirements:
- src/main.js initializes a MapLibre GL map in a full-viewport <div id="map">
- Map is centered on [-92.5, 38.5] (Missouri), zoom level 6
- Use a simple free raster tile style for now (OpenStreetMap tiles via raster source — 
  this is temporary, will be replaced with offline vector tiles in a later task)
- src/style.css makes the map div fill 100vw/100vh with no page margin/scroll
- index.html has a basic title "MO Dispersed Camping" and mounts the map

Verify `npm run dev` serves a working map and `npm run build` produces /app/dist 
successfully.

Add /app/README.md with setup instructions: npm install, npm run dev, npm run build.
```

---

### Task 2.2 — Load and render site data on the map

**Description:** Pull in `data/sites.geojson` and render every site as a marker.

**Acceptance criteria:**
- App loads `/data/sites.geojson` (copy or symlink it into `/app/public/data/sites.geojson` as part of the build, or fetch it at a configured relative path — document whichever approach is chosen).
- Every Feature renders as a MapLibre marker/circle layer on the map.
- Clicking a marker opens a popup showing: name, land_manager, access, amenities (as a comma list), fire_restrictions if present, cell_signal if present, and first photo if `photos` is non-empty (rendered as an `<img>`, gracefully hidden if the array is empty).
- Popup gracefully handles missing optional fields (no "undefined" text ever shown).
- Map auto-fits bounds to the data on initial load (with a sane max zoom so a single-site dataset doesn't zoom in absurdly far).

**Prompt for Qwen:**
```
In the mo-dispersed-camping /app project, add functionality to load and display the 
site dataset on the map.

1. Copy /data/sites.geojson into /app/public/data/sites.geojson as a build step (add 
   an npm script "sync-data" that copies it, and run it automatically before dev/build 
   via a pre-hook, or document manually running it — your choice, but document clearly 
   in /app/README.md)
2. In src/map.js, after the map loads, fetch /data/sites.geojson and add it as a 
   GeoJSON source
3. Render each feature as a circle marker layer (distinct color, reasonable size, 
   e.g. 8px radius, colored by land_manager if practical — Mark Twain National Forest 
   vs Missouri Department of Conservation could be two different colors, with a note 
   in code comments on how to extend this)
4. On marker click, open a MapLibre Popup showing:
   - name (bold heading)
   - land_manager
   - access
   - amenities joined as a comma list (omit line if empty)
   - fire_restrictions (omit if not present)
   - cell_signal (omit if not present)
   - first photo as an <img> tag, max-width 250px (omit entirely if photos array is empty)
   Ensure no field ever renders literal "undefined" or "null" text — check for 
   presence before rendering each line.
5. On initial load, fit the map bounds to cover all loaded features (use maplibre's 
   fitBounds with the data's bounding box), capping max zoom at something reasonable 
   like 12 so a small dataset doesn't over-zoom.

Test with the current /data/sites.geojson contents and confirm markers and popups work.
```

---

### Task 2.3 — Filter and search UI

**Description:** Basic sidebar/panel to filter sites by land manager, access type, and amenities, plus a search-by-name box.

**Acceptance criteria:**
- A collapsible sidebar (works on mobile width too — collapses to a toggle button under ~600px viewport) with:
  - Text search input filtering by `name` (case-insensitive substring match)
  - Checkbox filter group for `land_manager`
  - Checkbox filter group for `access`
  - Checkbox filter group for `amenities` (site matches if it has ANY checked amenity)
- Filters combine with AND logic across categories, OR logic within a category's checkboxes.
- Map markers update live as filters change (no page reload).
- A "Reset filters" button clears all filters and search back to showing everything.
- Filter panel doesn't rely on any external UI framework — plain HTML/CSS/JS is fine, but should look intentional, not default-browser-ugly (basic clean styling, not a design pass — that's a later task if desired).

**Prompt for Qwen:**
```
In the mo-dispersed-camping /app project, add a filter/search sidebar for the site data.

Requirements:
1. A sidebar panel (fixed left side, ~280px wide on desktop; collapses to a slide-out 
   triggered by a toggle button when viewport width is under 600px) containing:
   - A text input that filters sites by name (case-insensitive substring match)
   - A checkbox group for land_manager values present in the dataset
   - A checkbox group for access values present in the dataset
   - A checkbox group for all unique amenities values present across the dataset
   - A "Reset filters" button
2. Filter logic: a site must match the search text AND match at least one checked 
   land_manager (if any checked) AND at least one checked access (if any checked) 
   AND have at least one checked amenity (if any amenity checked). If no boxes in a 
   category are checked, that category doesn't filter (show all).
3. Filtering updates the map's rendered markers live, without a page reload, by 
   updating the GeoJSON source's data via setData() with the filtered feature list.
4. Basic clean CSS for the sidebar — doesn't need to be beautiful, but should not look 
   like unstyled browser defaults (padding, a border, readable checkbox labels, clear 
   section headings).

Test that combining search text with checkbox filters narrows the visible markers 
correctly, and that Reset restores all markers.
```

---

## Phase 3 — Offline Capability

### Task 3.1 — Generate offline vector tiles (PMTiles) for Missouri

**Description:** Produce a `.pmtiles` file covering Missouri so the basemap works fully offline, and wire it into the app.

**Acceptance criteria:**
- Document (in `/app/README.md` or a new `/docs/OFFLINE_TILES.md`) the process to generate a Missouri-extent `.pmtiles` file using an open source tool (e.g. `tilemaker` + OSM extract, or downloading a pre-built extract from a provider like Protomaps and clipping it to Missouri's bounding box with `pmtiles` CLI). Include the actual commands run.
- Resulting `.pmtiles` file is reasonably sized (target: under ~300MB for a Missouri-scale extent at reasonable zoom levels — document the zoom range chosen, e.g. z0-14).
- File is placed at `/app/public/tiles/missouri.pmtiles` (or referenced via a documented external hosting URL if too large for the repo — GitHub has file size limits, so if the file exceeds ~100MB, document using Git LFS or an external host like a GitHub Release asset instead of committing directly).
- `src/map.js` is updated to use the `pmtiles` JS library as a MapLibre protocol handler, loading `missouri.pmtiles` as the vector source with an appropriate style (e.g. a basic open style like Protomaps' default light style, or a minimal custom style covering roads/water/land-use/labels).
- Map renders correctly fully offline once the tile file and app shell are cached (verified in later task, but the tile loading mechanism itself must work standalone first).

**Prompt for Qwen:**
```
In the mo-dispersed-camping repo, set up offline vector tiles for Missouri using PMTiles.

1. Document in /docs/OFFLINE_TILES.md the exact steps to produce a Missouri-extent 
   .pmtiles file. Use the Protomaps approach: downloading or building a PMTiles extract 
   and using the `pmtiles` CLI tool's `extract` command to clip a larger basemap PMTiles 
   file down to Missouri's bounding box (roughly [-95.9, 35.9, -89.0, 40.7]), at zoom 
   levels 0-14. Write out the actual commands (pmtiles install instructions, download 
   source, extract command with the bbox flag).
2. Note the expected output file size and confirm whether it's small enough to commit 
   directly to the repo (under ~100MB) or needs external hosting — if too large, 
   document uploading it as a GitHub Release asset and note the app will fetch it from 
   that URL instead of bundling it.
3. In the /app project, install the `pmtiles` npm package and update src/map.js to:
   - Register the pmtiles protocol handler with maplibre-gl
   - Load the Missouri pmtiles file as a vector source (from /tiles/missouri.pmtiles 
     if bundled locally, or the documented external URL otherwise — make this a single 
     configurable constant at the top of map.js)
   - Apply a basic MapLibre style covering at minimum: land/water fill, road lines, 
     place labels. A minimal handwritten style is fine, doesn't need to be polished — 
     readability is the bar.
4. Confirm the map still renders the site markers and popups from earlier tasks on 
   top of the new offline basemap.
```

---

### Task 3.2 — Service worker for full offline support (PWA)

**Description:** Make the app installable and fully functional with no network connection after first load.

**Acceptance criteria:**
- `vite-plugin-pwa` (or Workbox directly) is configured to generate a service worker.
- `manifest.json` includes app name, short_name, icons (at least 192x192 and 512x512 placeholder icons — generated or simple placeholders are fine), theme_color, background_color, `display: "standalone"`.
- Service worker precaches: the app shell (HTML/JS/CSS bundle), `sites.geojson`, and the `.pmtiles` file (or documents that pmtiles' internal HTTP range-request chunking means it should be cached via a runtime caching strategy rather than precached wholesale — whichever is actually correct given how the `pmtiles` library fetches data, verify and document the reasoning).
- After first successful load with network, disabling network (e.g. Chrome DevTools "Offline" throttling) and reloading the app still shows a working map with markers, popups, and filters.
- A visible "Offline ready" or similar indicator appears once the service worker has successfully cached everything (simple UI toast/banner, doesn't need to be fancy).

**Prompt for Qwen:**
```
In the mo-dispersed-camping /app project, add full offline PWA support.

1. Install and configure vite-plugin-pwa.
2. Create a web app manifest: name "MO Dispersed Camping", short_name "MO Camping", 
   theme_color and background_color of your choice, display "standalone", and 
   placeholder icons at 192x192 and 512x512 (simple generated/solid-color placeholder 
   icons are fine for now).
3. Configure the service worker to precache the app shell (built JS/CSS/HTML) and 
   /data/sites.geojson.
4. For the missouri.pmtiles file: research how the pmtiles JS library fetches data 
   (it uses HTTP range requests for chunked access rather than fetching the whole file 
   at once). Determine and document in code comments whether this file should be 
   precached wholesale or handled via a runtime caching strategy (e.g. Workbox's 
   CacheFirst runtime caching matching the tiles URL pattern) so that range requests 
   still work correctly against the cached response. Implement whichever approach is 
   actually correct.
5. Add a small on-screen indicator (a toast or banner, dismissible) that appears once 
   the service worker reports it has successfully installed/cached everything, saying 
   something like "Ready for offline use."
6. Test: load the app once with network on, then simulate offline (browser devtools 
   network throttling set to Offline) and reload the page. Confirm the map, base tiles, 
   markers, and filters all still work with zero network requests succeeding beyond 
   the service worker's cache.
```

---

### Task 3.3 — Handle data updates gracefully

**Description:** Since the dataset will grow over time, the app needs a sane strategy for updating cached data without breaking the offline-first promise.

**Acceptance criteria:**
- Service worker uses a versioned cache name tied to a build/data version number.
- On app load, if network is available, the app checks for a newer `sites.geojson` in the background and updates the cache (stale-while-revalidate pattern), without blocking the initial render (which uses whatever's cached/available immediately).
- If a newer dataset is fetched, show a small non-intrusive "New data available — refresh to update" prompt rather than silently swapping data under the user mid-session.
- Document in `/app/README.md` how cache versioning/invalidation works and what a maintainer needs to do when publishing new data (bump a version constant, or rely on content-hash-based cache busting — pick one, document it).

**Prompt for Qwen:**
```
In the mo-dispersed-camping /app project, implement a stale-while-revalidate update 
strategy for the site dataset.

1. On app load, immediately render using whatever sites.geojson is currently cached 
   (or freshly fetched if this is the very first load with no cache yet).
2. In the background, if network is available, fetch the latest sites.geojson and 
   compare it to what's cached (a simple content hash or byte-length + timestamp 
   comparison is fine).
3. If the fetched version differs from cached, store the new version in the cache 
   but do NOT swap the currently rendered markers automatically. Instead show a small, 
   dismissible banner: "New data available — refresh to update" with a refresh button 
   that reloads the page to pick up the new cached data.
4. If offline, skip the background check entirely and just use cache.
5. Document this behavior in /app/README.md under an "## Updating data offline-first" 
   heading, including what a maintainer should do after editing sites.geojson and 
   publishing a new build (note whether cache-busting happens automatically via content 
   hashing in the build output filenames, or whether a manual version bump is needed 
   somewhere — implement and document whichever is simplest and actually correct given 
   the vite-plugin-pwa setup from the previous task).
```

---

## Phase 4 — Polish & Deployment

### Task 4.1 — Visual design pass

**Description:** Make the UI feel like a real product rather than a scaffold — this is a lower-priority polish task, do after everything above works functionally.

**Acceptance criteria:**
- Consistent color palette and typography applied across map controls, sidebar, popups, and banners.
- Mobile-responsive down to a ~375px viewport (iPhone SE-class) with no horizontal scroll or overlapping UI elements.
- Popups and sidebar have readable contrast and appropriate spacing/padding.
- A simple header/title bar with the app name.
- Loading state shown while initial tiles/data are fetching (not a blank white screen).

**Prompt for Qwen:**
```
In the mo-dispersed-camping /app project, do a visual polish pass over the existing 
functional UI (map, sidebar filters, popups, offline banners).

Requirements:
- Pick and consistently apply a simple color palette (2-3 colors plus neutrals) and 
  a clean sans-serif font stack across all UI elements
- Add a slim header bar at the top with the app name "MO Dispersed Camping"
- Ensure the layout is fully usable with no horizontal scroll or overlapping elements 
  down to 375px viewport width
- Improve popup styling: adequate padding, readable font sizes, clear visual hierarchy 
  between the site name and its details
- Add a simple loading indicator (spinner or skeleton state) shown while the map tiles 
  and site data are first loading, replacing any blank white screen flash
- Do not change any existing functionality — this is a styling-only pass

Confirm nothing that previously worked (filters, popups, offline mode) broke as a 
result of the styling changes.
```

---

### Task 4.2 — Deploy to GitHub Pages

**Description:** Ship it somewhere publicly accessible so it's actually "shared" as promised.

**Acceptance criteria:**
- GitHub Actions workflow builds the `/app` project and deploys `/app/dist` to GitHub Pages on every push to `main` (or a manually triggered workflow, contributor's choice — document which).
- Vite `base` config is correctly set for GitHub Pages' subpath hosting (e.g. `/mo-dispersed-camping/`) so assets resolve correctly.
- If the `.pmtiles` file is hosted externally (per Task 3.1's size decision), the deployed app correctly points at that external URL rather than a broken local path.
- Live URL is added to the root `README.md`.
- A fresh visit to the deployed URL (not localhost) is tested and confirmed working, including offline mode after first load.

**Prompt for Qwen:**
```
Set up GitHub Pages deployment for the mo-dispersed-camping /app project.

1. Add a GitHub Actions workflow (.github/workflows/deploy.yml) that, on push to main, 
   builds /app (npm install && npm run build) and deploys the resulting /app/dist to 
   GitHub Pages.
2. Update the Vite config's `base` option to match the GitHub Pages subpath (repo name 
   as the path prefix) so all built asset URLs resolve correctly when hosted at 
   https://<username>.github.io/mo-dispersed-camping/.
3. Confirm the pmtiles URL reference in map.js still resolves correctly under Pages 
   hosting — update the path/constant if needed depending on whether it's bundled or 
   externally hosted per the earlier offline tiles task.
4. Add the live Pages URL to the top of the root README.md.
5. Describe the manual verification steps to confirm the deployed app works correctly: 
   visiting the live URL fresh, confirming the map/markers/filters work, then testing 
   offline mode (load once, go offline, reload) against the live deployed version — 
   not just localhost.
```

---

## Suggested Order of Operations

1. Phase 0 (repo scaffolding) — one prompt
2. Phase 1 (dataset: schema → validator → seed data → GPX export → contributing docs) — five prompts, sequential
3. Phase 2 (app scaffold → render data → filters) — three prompts, sequential
4. Phase 3 (offline tiles → service worker → data update strategy) — three prompts, sequential, this is the trickiest phase, expect to iterate
5. Phase 4 (polish → deploy) — two prompts, do last

Total: ~14 discrete prompts. Feed them one at a time, verify each against its acceptance criteria before moving on — offline/PWA behavior especially is easy for a coding agent to claim works without actually testing, so Phase 3 is worth manually verifying yourself in a browser (DevTools offline mode) rather than trusting a description of success.
