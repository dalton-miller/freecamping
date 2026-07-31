// Service worker registration + "ready for offline use" indicator.
// virtual:pwa-register is provided by vite-plugin-pwa at build time.
import { registerSW } from 'virtual:pwa-register';

export function initPwa() {
  registerSW({
    immediate: true,
    onOfflineReady() {
      showToast('App cached — download the basemap (Filters → Offline basemap) for full offline use');
    },
  });
}

// Dismissible toast shown once the service worker has finished precaching
// the app shell and dataset. Auto-dismisses after a few seconds.
function showToast(message) {
  if (document.getElementById('offline-toast')) return;

  const toast = document.createElement('div');
  toast.id = 'offline-toast';
  toast.className = 'toast';
  toast.setAttribute('role', 'status');

  const msg = document.createElement('span');
  msg.textContent = message;

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'banner-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '×';
  dismiss.addEventListener('click', () => toast.remove());

  toast.append(msg, dismiss);
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 8000);
}
