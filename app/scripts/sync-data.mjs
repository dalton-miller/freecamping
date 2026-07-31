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
