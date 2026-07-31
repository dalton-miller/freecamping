import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { initFilters } from './filters.js';
import { loadSiteData, checkForDataUpdate, showUpdateBanner } from './data.js';

// ---------------------------------------------------------------------------
// Offline basemap configuration (single point of configuration).
//
// PMTILES_URL points at the Missouri-extent Protomaps basemap extract (see
// docs/OFFLINE_TILES.md for how it was generated). If the file is small
// enough it ships in the repo at public/tiles/missouri.pmtiles and is served
// relative to the app base; if it exceeds GitHub's ~100MB file limit it is
// hosted externally (e.g. as a GitHub Release asset — the Missouri extract is
// ~283MB, over GitHub's 100MB commit limit). In that case set the
// VITE_PMTILES_URL env var at build time to the absolute URL; otherwise the
// locally bundled file is used.
// ---------------------------------------------------------------------------
const PMTILES_URL =
  import.meta.env.VITE_PMTILES_URL || `${import.meta.env.BASE_URL}tiles/missouri.pmtiles`;

// Label glyphs for the vector basemap. PMTiles files contain vector tiles but
// not glyph PBFs, so these come from the Protomaps basemaps-assets CDN and are
// runtime-cached by the service worker (CacheFirst) so labels keep working
// offline after the first online load. See vite.config.js.
const GLYPHS_URL = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';

const DATA_URL = `${import.meta.env.BASE_URL}data/sites.geojson`;

// Register the pmtiles:// protocol so sources can reference the archive.
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// Minimal handwritten style over the Protomaps basemap tile schema (v4):
// land ("earth") fill, water fill, road lines, place labels. Readability is
// the bar, not polish.
function offlineVectorStyle() {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${PMTILES_URL}`,
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

// Fallback online basemap (OSM raster tiles) used only when the PMTiles
// archive isn't reachable — e.g. during local dev before the tile extract has
// been generated. The shipped/offline app always has the archive available.
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

async function resolveBasemapStyle() {
  try {
    // A 1-byte range request mirrors how the pmtiles library reads the
    // archive, so this is a faithful availability probe.
    const res = await fetch(PMTILES_URL, { headers: { Range: 'bytes=0-0' } });
    if (res.ok || res.status === 206) return offlineVectorStyle();
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn(
      `PMTiles basemap not available at ${PMTILES_URL} (${err.message}). ` +
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

export async function initMap() {
  const style = await resolveBasemapStyle();

  const map = new maplibregl.Map({
    container: 'map',
    style,
    center: [-92.5, 38.5], // Missouri
    zoom: 6,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');

  // Render immediately from the best cached copy (offline-first), then check
  // for a newer dataset in the background.
  const { data: siteData, text } = await loadSiteData(DATA_URL);
  checkForDataUpdate(DATA_URL, text, showUpdateBanner);

  map.on('load', () => {
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
    fitToData(map, siteData);
    initFilters(siteData, (filtered) => {
      map.getSource('sites').setData(filtered);
    });
  });
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

function addPopupHandlers(map) {
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
