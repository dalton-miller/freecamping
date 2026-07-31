// Opt-in offline basemap downloads, per region.
//
// Each region's PMTiles basemap is hundreds of MB — far too big to cache
// silently. This module renders one row per region (from the region registry)
// in the sidebar letting the user explicitly download that region's basemap
// for offline use (with progress + cancel), see that it's saved, or remove
// it. The service worker (src/sw.js) serves range requests from the cache
// this writes, and never caches the files on its own.

import { REGIONS_URL } from './map.js';

const BASEMAP_CACHE = 'mo-basemap-tiles'; // must match BASEMAP_CACHE in src/sw.js — do not rename (would strand existing downloads)

function humanSize(bytes) {
  if (!bytes) return 'unknown size';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

export async function initOfflineDownload(container) {
  if (!container) return;

  if (!('caches' in window)) {
    container.innerHTML =
      '<p class="offline-note">Offline storage is not available in this browser.</p>';
    return;
  }

  let regions = [];
  try {
    const res = await fetch(REGIONS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    regions = (await res.json()).regions || [];
  } catch {
    container.innerHTML =
      '<p class="offline-note">Region list unavailable — connect to the internet to manage offline basemaps.</p>';
    return;
  }

  // Per-region in-flight downloads: region.id -> AbortController.
  const aborts = new Map();
  // region.id -> row element, so progress updates don't re-render the list.
  const rows = new Map();

  async function isDownloaded(region) {
    const cache = await caches.open(BASEMAP_CACHE);
    return Boolean(await cache.match(region.pmtiles_url, { ignoreVary: true }));
  }

  function renderIdle(region, row) {
    const size = humanSize(region.size_bytes);
    row.innerHTML = `
      <p class="offline-note">${region.name} — ${size}</p>
      <button type="button">Download</button>`;
    row.querySelector('button').addEventListener('click', () => startDownload(region));
  }

  function renderProgress(region, row, received, total) {
    const pct = total ? Math.round((received / total) * 100) : 0;
    const mb = (n) => (n / 1024 / 1024).toFixed(0);
    row.innerHTML = `
      <p class="offline-note">Downloading ${region.name}… ${mb(received)} / ${total ? mb(total) : '?'} MB (${pct}%)</p>
      <progress value="${received}" max="${total || received}" aria-label="Download progress"></progress>
      <button type="button">Cancel</button>`;
    row.querySelector('button').addEventListener('click', () => {
      aborts.get(region.id)?.abort();
    });
  }

  function renderDone(region, row) {
    row.innerHTML = `
      <p class="offline-note offline-ok">✓ ${region.name} saved — works offline.</p>
      <button type="button">Remove</button>`;
    row.querySelector('button').addEventListener('click', async () => {
      const cache = await caches.open(BASEMAP_CACHE);
      await cache.delete(region.pmtiles_url, { ignoreVary: true });
      renderRegion(region);
    });
  }

  function renderError(region, row, message) {
    row.innerHTML = `
      <p class="offline-note offline-error">${region.name} download failed: ${message}</p>
      <button type="button">Try again</button>`;
    row.querySelector('button').addEventListener('click', () => startDownload(region));
  }

  async function renderRegion(region) {
    const row = rows.get(region.id);
    if (!row || aborts.has(region.id)) return; // progress UI owns the row
    if (await isDownloaded(region)) {
      renderDone(region, row);
    } else {
      renderIdle(region, row);
    }
  }

  async function startDownload(region) {
    const controller = new AbortController();
    aborts.set(region.id, controller);
    const row = rows.get(region.id);
    renderProgress(region, row, 0, 0);
    try {
      const res = await fetch(region.pmtiles_url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const total = Number(res.headers.get('Content-Length')) || region.size_bytes || 0;
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        renderProgress(region, row, received, total);
      }

      const cache = await caches.open(BASEMAP_CACHE);
      await cache.put(
        region.pmtiles_url,
        new Response(new Blob(chunks), {
          headers: { 'Content-Type': 'application/octet-stream' },
        }),
      );
      renderDone(region, row);
    } catch (err) {
      // Clear the abort entry BEFORE rendering — renderRegion() treats a
      // present entry as "download in progress" and refuses to touch the row,
      // which would leave a canceled row wedged on the progress UI.
      aborts.delete(region.id);
      if (err.name === 'AbortError') {
        renderRegion(region);
      } else {
        renderError(region, row, err.message);
      }
    } finally {
      aborts.delete(region.id);
    }
  }

  container.innerHTML =
    '<p class="offline-note">Basemaps load on demand while online. Downloads are ' +
    'opt-in per region — save only the regions you need offline.</p>';
  for (const region of regions) {
    const row = document.createElement('div');
    row.className = 'offline-region';
    container.appendChild(row);
    rows.set(region.id, row);
    await renderRegion(region);
  }
}
