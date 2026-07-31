// Offline-first loading of the site dataset with a stale-while-revalidate
// update strategy.
//
// Two layers of caching are involved:
//
// 1. The service worker precaches /data/sites.geojson as part of the app
//    shell (see vite.config.js). That guarantees the data is available
//    offline, but the precache only updates when a new build is deployed and
//    the new service worker activates.
//
// 2. An app-managed Cache Storage bucket (DATA_CACHE) holds the newest
//    dataset we've seen. When a background freshness check finds newer data
//    on the network, we write it here and prompt the user to refresh — the
//    refresh then reads from this cache, picking up the new data without
//    waiting for a redeploy/service-worker update.
//
// On load we prefer (2), falling back to (1)/network. This keeps the first
// render instant (whatever is cached is used immediately) while still letting
// the dataset grow over time.

const DATA_CACHE = 'mo-camping-data-v1';

const EMPTY = { type: 'FeatureCollection', features: [] };

// Load the best available copy of the dataset as fast as possible.
// Returns { data, text } — text is the raw body, kept for later comparison
// by the background freshness check.
export async function loadSiteData(url) {
  try {
    const cache = await caches.open(DATA_CACHE);
    const cached = await cache.match(url);
    if (cached) {
      const text = await cached.text();
      return { data: JSON.parse(text), text };
    }
  } catch (err) {
    console.warn('Cache Storage unavailable, falling back to fetch:', err);
  }

  // First visit (nothing in the app-managed cache yet). This fetch is served
  // by the service worker's precache when offline, or the network otherwise.
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    // Seed the app-managed cache so future freshness checks have a baseline.
    try {
      const cache = await caches.open(DATA_CACHE);
      await cache.put(url, new Response(text, { headers: { 'Content-Type': 'application/geo+json' } }));
    } catch {
      // Non-fatal — we'll just re-seed on a later load.
    }

    return { data: JSON.parse(text), text };
  } catch (err) {
    console.error('Failed to load site data:', err);
    return { data: EMPTY, text: '' };
  }
}

// Background freshness check (stale-while-revalidate). If the network copy
// differs from what's currently rendered, store it in the app-managed cache
// and invoke onUpdate() — the caller shows a "refresh to update" prompt
// rather than silently swapping data mid-session.
//
// The ?ts= cache-buster makes the request URL not match the service worker's
// precache entry (Workbox precaching ignores only configured URL parameters),
// so this genuinely reaches the network when online.
export async function checkForDataUpdate(url, currentText, onUpdate) {
  if (!navigator.onLine) return; // offline: just keep using the cache
  try {
    const res = await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const text = await res.text();
    if (text === currentText) return; // already up to date

    // Validate it's parseable before caching it.
    JSON.parse(text);

    const cache = await caches.open(DATA_CACHE);
    await cache.put(url, new Response(text, { headers: { 'Content-Type': 'application/geo+json' } }));
    onUpdate();
  } catch {
    // Network failure or bad data — silently keep the current version.
  }
}

// Small dismissible banner prompting the user to refresh for new data.
export function showUpdateBanner() {
  if (document.getElementById('data-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'data-update-banner';
  banner.className = 'banner banner-info';
  banner.setAttribute('role', 'status');

  const msg = document.createElement('span');
  msg.textContent = 'New data available — refresh to update';

  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Refresh';
  refresh.addEventListener('click', () => window.location.reload());

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'banner-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '×';
  dismiss.addEventListener('click', () => banner.remove());

  banner.append(msg, refresh, dismiss);
  document.body.appendChild(banner);
}
