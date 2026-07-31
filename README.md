# Free Camping Map

**Live app:** https://dalton-miller.github.io/freecamping/ (see [app/README.md](app/README.md#deployment-github-pages))

An open dataset of free dispersed camping locations on public land — currently covering Missouri (primarily Mark Twain National Forest and Missouri Department of Conservation (MDC) conservation areas), with more regions planned — plus an installable, offline-capable map app (PWA) for browsing it. The dataset lives in [`data/`](data/) as canonical GeoJSON (with a GPX export for GPS apps), and the offline PWA lives in [`app/`](app/). Basemap coverage is organized by region in [`data/regions.json`](data/regions.json); to add a new region, see [`docs/OFFLINE_TILES.md`](docs/OFFLINE_TILES.md). Contributions of new or corrected sites are welcome; see [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

## Repository layout

```
/data/     The dataset: sites.geojson (canonical), regions.json, schema.json, photos/
/scripts/  Utility scripts (validation, GPX export)
/app/      The offline-capable map SPA
/docs/     CONTRIBUTING.md, DATA_SCHEMA.md, OFFLINE_TILES.md
```

## Validating data

All dataset entries are validated against `data/schema.json` before merging:

```
pip install -r scripts/requirements.txt
python scripts/validate_data.py
```

Add `--strict` to also warn about missing recommended fields (photos, description). The script checks schema conformance, Point geometry, that every site falls inside at least one registered region's bbox from `data/regions.json` (falling back to a continental-US sanity box if that file is missing), and unique site ids.

## Getting the data

- **`data/sites.geojson`** is the canonical, richest source. Use this if you're building on the dataset directly or your tool supports GeoJSON.
- **`data/sites.gpx`** is a portable export for GPS apps like OsmAnd, Gaia GPS, and Garmin devices.

After editing the GeoJSON, regenerate the GPX with:

```
python scripts/geojson_to_gpx.py
```

## License

Two licenses apply to different parts of this repository:

- **Dataset** (`/data`, including `sites.geojson`, `regions.json`, `schema.json`, and photos): [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). ODbL is designed for data; a software license like MIT is not.
- **App code and scripts** (`/app`, `/scripts`): [MIT License](https://opensource.org/licenses/MIT).

See the `LICENSE` file for the full text of both.
