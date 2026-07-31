import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Matches the PMTILES_URL constant in src/map.js — keep both in sync. The
// basemap may be served locally (/tiles/missouri.pmtiles) or from an external
// host, so the runtime cache pattern matches the filename anywhere.
const PMTILES_CACHE_PATTERN = /missouri\.pmtiles$/;

export default defineConfig({
  // GitHub Pages hosts the site under /<repo-name>/ rather than the domain
  // root, so all built asset URLs need this prefix. VITE_BASE_PATH allows an
  // override (e.g. for local testing or a custom domain, set it to '/').
  base: process.env.VITE_BASE_PATH || '/mo-dispersed-camping/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MO Dispersed Camping',
        short_name: 'MO Camping',
        description:
          'Offline-capable map of free dispersed camping locations on Missouri public land.',
        theme_color: '#2e7d32',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell (built JS/CSS/HTML), icons, and the site
        // dataset. Note: the .pmtiles basemap is deliberately NOT in
        // globPatterns — see the runtimeCaching entry below.
        globPatterns: ['**/*.{js,css,html,png,ico,svg,geojson}'],
        runtimeCaching: [
          {
            // The pmtiles JS library reads the archive with HTTP Range
            // requests (fetching small byte ranges on demand) rather than
            // downloading the whole file. Precaching it wholesale would force
            // a full multi-hundred-MB download on first install and Workbox
            // precaching does not honor Range requests. Instead we use a
            // runtime CacheFirst strategy with the rangeRequests plugin,
            // which serves 206 partial responses from the cached full
            // response. The whole archive is cached on first use and every
            // subsequent range read is satisfied from cache — online or off.
            urlPattern: ({ url }) =>
              PMTILES_CACHE_PATTERN.test(url.pathname) || url.href.endsWith('missouri.pmtiles'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mo-basemap-tiles',
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200, 206] },
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year — basemap changes rarely
              },
            },
          },
          {
            // Label glyphs for the vector basemap (PMTiles archives don't
            // contain glyph PBFs). Cached on first online load so labels keep
            // rendering offline afterwards.
            urlPattern: /^https:\/\/protomaps\.github\.io\/basemaps-assets\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mo-basemap-glyphs',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
});
