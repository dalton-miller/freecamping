# MO Dispersed Camping

An open-source dataset of free dispersed camping locations on public land in Missouri — primarily Mark Twain National Forest and Missouri Department of Conservation (MDC) conservation areas — plus an installable, offline-capable map app for browsing it. The dataset lives in [`data/`](data/) as canonical GeoJSON (with a GPX export for GPS apps), and the offline PWA lives in [`app/`](app/). Contributions of new or corrected sites are welcome; see [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

## Repository layout

```
/data/     The dataset: sites.geojson (canonical), schema.json, photos/
/scripts/  Utility scripts (validation, GPX export)
/app/      The offline-capable map SPA
/docs/     CONTRIBUTING.md, DATA_SCHEMA.md
```

## License

Two licenses apply to different parts of this repository:

- **Dataset** (`/data`, including `sites.geojson`, `schema.json`, and photos): [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). ODbL is designed for data; a software license like MIT is not.
- **App code and scripts** (`/app`, `/scripts`): [MIT License](https://opensource.org/licenses/MIT).

See the `LICENSE` file for the full text of both.
