import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages hosts the site under /<repo-name>/ rather than the domain
  // root, so all built asset URLs need this prefix. VITE_BASE_PATH allows an
  // override (e.g. for local testing or a custom domain, set it to '/').
  base: process.env.VITE_BASE_PATH || '/freecamping/',
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Free Camping Map',
        short_name: 'Camping',
        description:
          'Offline-capable map of free dispersed camping locations on public land.',
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
      // Precache the app shell (built JS/CSS/HTML), icons, the site
      // dataset, and the region registry (regions.json — tiny, and required
      // to pick the offline basemap when booting offline). The .pmtiles
      // basemaps are deliberately NOT precached — users opt in to the large
      // per-region offline downloads (see src/sw.js and src/offline.js).
      injectManifest: {
        globPatterns: ['**/*.{js,mjs,css,html,png,ico,svg,geojson,json}'],
      },
    }),
  ],
});
