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

- Map centered on Missouri using OpenStreetMap raster tiles as a temporary
  basemap (to be replaced with offline PMTiles vector tiles in a later phase).
- Every site in the dataset rendered as a circle marker, colored by land
  manager (green = Mark Twain National Forest, blue = Missouri Department of
  Conservation).
- Click a marker for a popup with the site's details (missing optional fields
  are omitted gracefully).
- Sidebar with name search plus checkbox filters for land manager, access,
  and amenities (AND across categories, OR within a category). The sidebar
  collapses to a toggle button on viewports under 600px wide.
