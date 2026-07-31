import './style.css';
import { initMap } from './map.js';
import { initPwa } from './pwa.js';
import { initOfflineDownload } from './offline.js';

initPwa();
initMap();
initOfflineDownload(document.getElementById('offline-controls'));
