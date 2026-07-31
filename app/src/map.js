import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initFilters } from './filters.js';

// Temporary online basemap — replaced with offline PMTiles vector tiles in a
// later phase. OSM raster tiles via a minimal raster style.
const BASEMAP_STYLE = {
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
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

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

const DATA_URL = `${import.meta.env.BASE_URL}data/sites.geojson`;

export async function initMap() {
  const map = new maplibregl.Map({
    container: 'map',
    style: BASEMAP_STYLE,
    center: [-92.5, 38.5], // Missouri
    zoom: 6,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');

  const siteData = await fetchSiteData();

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

async function fetchSiteData() {
  const empty = { type: 'FeatureCollection', features: [] };
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to load site data:', err);
    return empty;
  }
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
