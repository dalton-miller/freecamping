import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre v6 splits its web worker into a separate module and resolves it
// relative to import.meta.url, which breaks under bundlers (the file is
// never emitted and the request 404s/hangs). Import it explicitly so Vite
// emits it as an asset with the correct base path, and point MapLibre at it.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
maplibregl.setWorkerUrl(maplibreWorkerUrl);
import { Protocol } from 'pmtiles';
import { initFilters } from './filters.js';
import { loadSiteData, checkForDataUpdate, showUpdateBanner } from './data.js';

// ---------------------------------------------------------------------------
// Multi-region basemap configuration.
//
// regions.json is the region registry (see /data/regions.json): each region
// has an id, name, bbox [minLon, minLat, maxLon, maxLat], pmtiles_url, and
// size_bytes. The app picks the basemap by viewport center: the initial
// region is the one containing the site dataset's center (falling back to
// the first region in the list), and the basemap switches when the viewport
// center moves into a different region. Each region's PMTiles archive is a
// Protomaps basemap extract (see docs/OFFLINE_TILES.md for how they are
// generated and hosted).
// ---------------------------------------------------------------------------
export const REGIONS_URL = `${import.meta.env.BASE_URL}data/regions.json`;

// Label glyphs for the vector basemap. PMTiles files contain vector tiles but
// not glyph PBFs, so these come from the Protomaps basemaps-assets CDN and are
// runtime-cached by the service worker (CacheFirst) so labels keep working
// offline after the first online load. See vite.config.js.
const GLYPHS_URL = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';

const DATA_URL = `${import.meta.env.BASE_URL}data/sites.geojson`;

// Register the pmtiles:// protocol so sources can reference the archive.
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// Fetch the region registry. On failure (offline before first precache,
// missing file) fall back to an empty list — the map then uses the raster
// fallback style.
async function loadRegions() {
  try {
    const res = await fetch(REGIONS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json.regions) ? json.regions : [];
  } catch (err) {
    console.warn(`Region registry not available at ${REGIONS_URL} (${err.message}).`);
    return [];
  }
}

// First region whose bbox contains the point, else null.
// lngLat is anything with .lng/.lat (e.g. maplibregl.LngLat).
export function regionForCenter(regions, lngLat) {
  for (const region of regions) {
    const [minLon, minLat, maxLon, maxLat] = region.bbox;
    if (lngLat.lng >= minLon && lngLat.lng <= maxLon && lngLat.lat >= minLat && lngLat.lat <= maxLat) {
      return region;
    }
  }
  return null;
}

// Minimal handwritten style over the Protomaps basemap tile schema (v4):
// land ("earth") fill, water fill, road lines, place labels. Readability is
// the bar, not polish. Takes the region's PMTiles URL.
function offlineVectorStyle(pmtilesUrl) {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#e8e6df' },
      },
      {
        id: 'earth',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'earth',
        paint: { 'fill-color': '#e8e6df' },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'water',
        paint: { 'fill-color': '#b3d1e8' },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 2.5],
        },
      },
      {
        id: 'places-labels',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'places',
        filter: ['in', ['get', 'kind'], ['literal', ['locality', 'region', 'country']]],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 14],
        },
        paint: {
          'text-color': '#3a3a3a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.2,
        },
      },
    ],
  };
}

// Fallback online basemap (OSM raster tiles) used only when the region's
// PMTiles archive isn't reachable — e.g. during local dev before the tile
// extract has been generated.
const RASTER_FALLBACK_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: 'osm-tiles', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 },
  ],
};

async function resolveBasemapStyle(region) {
  try {
    // A 1-byte range request mirrors how the pmtiles library reads the
    // archive, so this is a faithful availability probe.
    const res = await fetch(region.pmtiles_url, { headers: { Range: 'bytes=0-0' } });
    if (res.ok || res.status === 206) return offlineVectorStyle(region.pmtiles_url);
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn(
      `PMTiles basemap not available at ${region.pmtiles_url} (${err.message}). ` +
        'Falling back to online OSM raster tiles. See docs/OFFLINE_TILES.md.',
    );
    return RASTER_FALLBACK_STYLE;
  }
}

// Marker colors per land_manager. To extend: add another [value, color] pair
// to this match expression (and a fallback at the end).
const LAND_MANAGER_COLORS = [
  'match',
  ['get', 'land_manager'],
  'Mark Twain National Forest',
  '#2e7d32', // green — USFS
  'Missouri Department of Conservation',
  '#1565c0', // blue — MDC
  '#6d4c41', // brown fallback for "Other"/unknown
];

// Center of the site dataset's bounding box, or null if there are no points.
function dataCenter(data) {
  const features = data.features || [];
  if (features.length === 0) return null;

  const bounds = new maplibregl.LngLatBounds();
  for (const f of features) {
    if (f.geometry?.type === 'Point') {
      bounds.extend(f.geometry.coordinates);
    }
  }
  return bounds.isEmpty() ? null : bounds.getCenter();
}

// (Re)add the sites source, marker layer, and popup handlers. Called on
// initial load and after every basemap style switch (setStyle drops all
// runtime sources/layers).
function addSitesLayer(map, siteData) {
  map.addSource('sites', {
    type: 'geojson',
    data: siteData,
  });

  map.addLayer({
    id: 'site-markers',
    type: 'circle',
    source: 'sites',
    paint: {
      'circle-radius': 8,
      'circle-color': LAND_MANAGER_COLORS,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  addPopupHandlers(map);
}

// Switch the basemap to a different region's PMTiles archive (or the raster
// fallback if it isn't reachable), then restore the site markers once the
// new style has loaded. `generation` guards against concurrent switches: if
// a newer switch started while we were awaiting the availability probe,
// abandon this one entirely (its style.load re-add would collide with the
// newer one and/or overwrite the newer basemap).
async function switchBasemap(map, region, getData, generation, isCurrent) {
  const style = await resolveBasemapStyle(region);
  if (!isCurrent(generation)) return;
  // Register before setStyle so the listener can't miss the event.
  map.once('style.load', () => {
    if (isCurrent(generation)) addSitesLayer(map, getData());
  });
  map.setStyle(style);
}

export async function initMap() {
  // Fetch the region registry and render from the best cached copy of the
  // site data (offline-first) in parallel; then check for a newer dataset
  // in the background.
  const [regions, { data: siteData, text }] = await Promise.all([
    loadRegions(),
    loadSiteData(DATA_URL),
  ]);
  checkForDataUpdate(DATA_URL, text, showUpdateBanner);

  // Initial region: the one containing the dataset's center, else the first
  // region in the list, else none (raster fallback).
  const center = dataCenter(siteData);
  const initialRegion = (center && regionForCenter(regions, center)) || regions[0] || null;
  const style = initialRegion
    ? await resolveBasemapStyle(initialRegion)
    : RASTER_FALLBACK_STYLE;

  const map = new maplibregl.Map({
    container: 'map',
    style,
    center: center ? [center.lng, center.lat] : [-98.5, 39.5], // fallback: contiguous US
    zoom: 4,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');

  // "Locate me" button: shows the user's position as a dot on the map and
  // flies to it. Uses the browser Geolocation API; browsers require HTTPS
  // (or localhost) and user permission. With trackUserLocation the control
  // keeps the dot live as the user moves, which is what you want in the
  // field. The accuracy circle is drawn by the control itself, so no extra
  // sources/layers are needed (and it survives basemap style switches).
  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserLocation: true,
  });
  map.addControl(geolocate, 'top-right');
  geolocate.on('error', (e) => {
    // Permission denied / position unavailable — surface it, don't fail silently.
    console.warn(`Geolocation unavailable: ${e.message ?? e.code}`);
  });

  // Capture the 'load' event as a promise BEFORE doing any async work — the
  // style (especially the tiny raster fallback) can finish loading while
  // we're still awaiting other work, and a listener registered after the
  // event has fired never runs (no markers, stuck loading overlay).
  const mapLoaded = new Promise((resolve) => {
    if (map.loaded()) resolve();
    else map.once('load', resolve);
  });

  // State for basemap switching (declared before the filter wiring below —
  // initFilters may invoke its callback immediately). latestSitesData
  // carries the active filter selection so markers stay filtered after a
  // switch; switchGeneration abandons superseded concurrent switches.
  let currentPmtilesUrl = initialRegion?.pmtiles_url ?? null;
  let latestSitesData = siteData;
  let switchGeneration = 0;
  const isCurrent = (g) => g === switchGeneration;

  await mapLoaded;
  {
    addSitesLayer(map, siteData);
    fitToData(map, siteData);
    initFilters(siteData, (filtered) => {
      latestSitesData = filtered; // remember active filters across basemap switches
      // The source is briefly absent during a basemap style switch.
      map.getSource('sites')?.setData(filtered);
    });

    hideLoading();
  }

  // Switch the basemap when the viewport center moves into a different
  // region served by a different PMTiles archive.
  map.on('moveend', () => {
    const region = regionForCenter(regions, map.getCenter());
    if (region && region.pmtiles_url !== currentPmtilesUrl) {
      currentPmtilesUrl = region.pmtiles_url;
      switchBasemap(map, region, () => latestSitesData, ++switchGeneration, isCurrent);
    }
  });
}

// Dismiss the full-screen loading overlay once the map style and site data
// have finished loading (called from the map 'load' handler).
function hideLoading() {
  document.getElementById('loading')?.classList.add('hidden');
}

function fitToData(map, data) {
  const features = data.features || [];
  if (features.length === 0) return;

  const bounds = new maplibregl.LngLatBounds();
  for (const f of features) {
    if (f.geometry?.type === 'Point') {
      bounds.extend(f.geometry.coordinates);
    }
  }
  if (bounds.isEmpty()) return;

  // Cap max zoom so a tiny dataset doesn't zoom in absurdly far.
  map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
}

// Map-level event handlers survive map.setStyle(), so register them only
// once per map even though addSitesLayer runs again after every basemap
// switch (re-registering would stack duplicate click handlers/popups).
const popupHandlerMaps = new WeakSet();

function addPopupHandlers(map) {
  if (popupHandlerMaps.has(map)) return;
  popupHandlerMaps.add(map);

  map.on('click', 'site-markers', (e) => {
    const feature = e.features?.[0];
    if (!feature) return;

    new maplibregl.Popup({ maxWidth: '300px' })
      .setLngLat(feature.geometry.coordinates)
      .setHTML(buildPopupHtml(feature.properties || {}))
      .addTo(map);
  });

  map.on('mouseenter', 'site-markers', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'site-markers', () => {
    map.getCanvas().style.cursor = '';
  });
}

// Build popup HTML, omitting any line whose field is missing/empty so no
// literal "undefined"/"null" text is ever shown.
function buildPopupHtml(props) {
  const escape = (s) =>
    String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  const lines = [];
  lines.push(`<strong class="popup-title">${escape(props.name ?? 'Unnamed site')}</strong>`);

  if (props.land_manager) lines.push(`<div>${escape(props.land_manager)}</div>`);
  if (props.access) lines.push(`<div>Access: ${escape(props.access)}</div>`);
  if (Array.isArray(props.amenities) && props.amenities.length > 0) {
    lines.push(`<div>Amenities: ${escape(props.amenities.join(', '))}</div>`);
  }
  if (props.fire_restrictions) {
    lines.push(`<div>Fire: ${escape(props.fire_restrictions)}</div>`);
  }
  if (props.cell_signal) lines.push(`<div>Cell signal: ${escape(props.cell_signal)}</div>`);
  if (Array.isArray(props.photos) && props.photos.length > 0 && props.photos[0]) {
    lines.push(
      `<img src="${escape(props.photos[0])}" alt="Photo of ${escape(props.name ?? 'site')}" style="max-width:250px" />`,
    );
  }

  return lines.join('');
}
