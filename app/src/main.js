import './style.css';
import { initMap, PMTILES_URL } from './map.js';
import { initPwa } from './pwa.js';
import { initOfflineDownload } from './offline.js';

initPwa();
initMap();
initOfflineDownload(PMTILES_URL, document.getElementById('offline-controls'));
