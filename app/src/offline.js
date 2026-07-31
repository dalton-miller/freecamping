// Opt-in offline basemap download.
//
// The PMTiles basemap is ~283MB — far too big to cache silently. This module
// renders a small control in the sidebar letting the user explicitly download
// it for offline use (with progress + cancel), see that it's saved, or remove
// it. The service worker (src/sw.js) serves range requests from the cache it
// writes here, and never caches the file on its own.

const BASEMAP_CACHE = 'mo-basemap-tiles';

export async function initOfflineDownload(pmtilesUrl, container) {
  if (!container) return;

  if (!('caches' in window)) {
    container.innerHTML =
      '<p class="offline-note">Offline storage is not available in this browser.</p>';
    return;
  }

  const state = { abort: null };

  async function isDownloaded() {
    const cache = await caches.open(BASEMAP_CACHE);
    return Boolean(await cache.match(pmtilesUrl, { ignoreVary: true }));
  }

  function renderIdle(sizeMB) {
    container.innerHTML = `
      <p class="offline-note">Basemap tiles load on demand while online. Download
      the full Missouri basemap (~${sizeMB} MB) to use the map fully offline.</p>
      <button type="button" id="offline-download-btn">Download for offline use (~${sizeMB} MB)</button>`;
    container.querySelector('#offline-download-btn').addEventListener('click', startDownload);
  }

  function renderProgress(received, total) {
    const pct = total ? Math.round((received / total) * 100) : 0;
    const mb = (n) => (n / 1024 / 1024).toFixed(0);
    container.innerHTML = `
      <p class="offline-note">Downloading basemap… ${mb(received)} / ${total ? mb(total) : '?'} MB (${pct}%)</p>
      <progress value="${received}" max="${total || received}" aria-label="Download progress"></progress>
      <button type="button" id="offline-cancel-btn">Cancel</button>`;
    container.querySelector('#offline-cancel-btn').addEventListener('click', () => {
      state.abort?.abort();
    });
  }

  function renderDone() {
    container.innerHTML = `
      <p class="offline-note offline-ok">✓ Offline basemap saved — the map works without a connection.</p>
      <button type="button" id="offline-remove-btn">Remove offline basemap</button>`;
    container.querySelector('#offline-remove-btn').addEventListener('click', async () => {
      const cache = await caches.open(BASEMAP_CACHE);
      await cache.delete(pmtilesUrl, { ignoreVary: true });
      render();
    });
  }

  function renderError(message) {
    container.innerHTML = `
      <p class="offline-note offline-error">Download failed: ${message}</p>
      <button type="button" id="offline-retry-btn">Try again</button>`;
    container.querySelector('#offline-retry-btn').addEventListener('click', render);
  }

  async function startDownload() {
    state.abort = new AbortController();
    renderProgress(0, 0);
    try {
      const res = await fetch(pmtilesUrl, { signal: state.abort.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const total = Number(res.headers.get('Content-Length')) || 0;
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        renderProgress(received, total);
      }

      const cache = await caches.open(BASEMAP_CACHE);
      await cache.put(
        pmtilesUrl,
        new Response(new Blob(chunks), {
          headers: { 'Content-Type': 'application/octet-stream' },
        }),
      );
      renderDone();
    } catch (err) {
      if (err.name === 'AbortError') {
        render();
      } else {
        renderError(err.message);
      }
    } finally {
      state.abort = null;
    }
  }

  async function render() {
    container.innerHTML = '<p class="offline-note">Checking offline status…</p>';
    if (await isDownloaded()) {
      renderDone();
    } else {
      // Best-effort size for the button label; HEAD may fail offline, that's fine.
      let sizeMB = 283;
      try {
        const head = await fetch(pmtilesUrl, { method: 'HEAD' });
        const len = Number(head.headers.get('Content-Length'));
        if (len) sizeMB = Math.round(len / 1024 / 1024);
      } catch {
        /* offline or HEAD blocked — use the known approximate size */
      }
      renderIdle(sizeMB);
    }
  }

  await render();
}
