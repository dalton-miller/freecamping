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
      // Precache the app shell (built JS/CSS/HTML), icons, and the site
      // dataset. The .pmtiles basemap is deliberately NOT precached — users
      // opt in to the ~283MB offline download (see src/sw.js and
      // src/offline.js).
      injectManifest: {
        globPatterns: ['**/*.{js,mjs,css,html,png,ico,svg,geojson}'],
      },
    }),
  ],
});
