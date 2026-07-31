// Copies the canonical dataset from the repo's /data folder into the app's
// public folder so Vite serves it at /data/sites.geojson in dev and includes
// it in the production build.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(appRoot, '../data/sites.geojson');
const dest = resolve(appRoot, 'public/data/sites.geojson');

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`Synced ${src} -> ${dest}`);

// MapLibre GL v6 resolves its shared module relative to import.meta.url
// (i.e. /assets/maplibre-gl-shared.mjs), which bundlers don't rewrite —
// without this the deployed app 404s on it. Ship the file from the installed
// maplibre-gl package at that exact path so the runtime resolution works.
// (The web worker file is handled separately via a ?url import in
// src/map.js, since maplibregl.setWorkerUrl() lets us point at the hashed
// asset; the shared module path is not configurable.)
const sharedSrc = resolve(appRoot, 'node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs');
const sharedDest = resolve(appRoot, 'public/assets/maplibre-gl-shared.mjs');
mkdirSync(dirname(sharedDest), { recursive: true });
copyFileSync(sharedSrc, sharedDest);
console.log(`Synced ${sharedSrc} -> ${sharedDest}`);
