// Custom service worker (injectManifest strategy).
//
// Offline policy:
// - App shell + dataset: precached (self.__WB_MANIFEST is replaced at build
//   time with the precache list, per injectManifest.globPatterns).
// - Basemap glyphs: CacheFirst, cached on first online load.
// - PMTiles basemaps (~283MB each): OPT-IN ONLY. This worker never downloads or
//   caches it automatically. The app puts a full copy into the
//   'mo-basemap-tiles' cache only when the user explicitly downloads it
//   (src/offline.js). Here we serve range requests from that cache when it
//   exists, and otherwise pass straight through to the network WITHOUT
//   caching — so casual visitors never pull the big file.

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { createPartialResponse } from 'workbox-range-requests';

export const BASEMAP_CACHE = 'mo-basemap-tiles';
const GLYPHS_CACHE = 'mo-basemap-glyphs';
const ONE_YEAR = 60 * 60 * 24 * 365;

// Take over immediately on update (registerType: 'autoUpdate') — otherwise a
// stale worker keeps controlling open tabs until every one closes.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback to the precached app shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Label glyphs for the vector basemap (PMTiles archives don't contain glyph
// PBFs). Small, so CacheFirst-on-first-use is fine.
registerRoute(
  /^https:\/\/protomaps\.github\.io\/basemaps-assets\//,
  new CacheFirst({
    cacheName: GLYPHS_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: ONE_YEAR }),
    ],
  }),
);

// PMTiles basemaps (one per region): cache-aware passthrough. The pmtiles
// JS library reads the archive with HTTP Range requests. If the user has
// downloaded the archive for offline use, serve those ranges from the
// cached full response (206 partials via createPartialResponse). If not,
// fetch from the network and DO NOT cache — these huge files only enter the
// cache via the explicit opt-in downloads in src/offline.js.
registerRoute(
  ({ url }) => url.href.endsWith('.pmtiles'),
  async ({ request }) => {
    const cache = await caches.open(BASEMAP_CACHE);
    // Range headers don't participate in cache matching; Vary: Origin (from
    // the CDN) shouldn't block a match either.
    const cached = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
    if (cached) {
      return request.headers.has('range') ? createPartialResponse(request, cached) : cached;
    }
    return fetch(request);
  },
);
