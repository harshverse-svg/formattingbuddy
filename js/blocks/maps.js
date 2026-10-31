/**
 * FormattingBuddy - Map Block Renderer using Leaflet & Nominatim Geocoding
 * Nominatim rate limit: maximum 1 request per second, responses cached in localStorage.
 */

const STORAGE_KEY_GEOCACHE = 'formattingbuddy_geocache_v1';
let geocache = null;
let lastRequestTime = 0;

function loadGeoCache() {
  if (geocache) return geocache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GEOCACHE);
    geocache = raw ? JSON.parse(raw) : {};
  } catch {
    geocache = {};
  }
  return geocache;
}

function saveGeoCache() {
  try {
    localStorage.setItem(STORAGE_KEY_GEOCACHE, JSON.stringify(geocache));
  } catch (err) {
    console.warn('Failed saving geocache', err);
  }
}

/**
 * Geocodes a place name to { lat, lon, displayName } using Nominatim.
 * Strictly respects 1 req/sec rate limit and uses local cache.
 */
export async function geocodePlace(placeName) {
  const cache = loadGeoCache();
  const key = placeName.trim().toLowerCase();

  if (cache[key]) {
    return cache[key];
  }

  // Enforce 1000ms minimum interval between Nominatim network calls
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1050) {
    await new Promise((resolve) => setTimeout(resolve, 1050 - elapsed));
  }

  lastRequestTime = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(placeName)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      console.warn(`Nominatim error HTTP ${res.status} for "${placeName}"`);
      return null;
    }

    const data = await res.json();
    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
      cache[key] = result;
      saveGeoCache();
      return result;
    } else {
      // Negative cache so we don't spam query unknown places
      cache[key] = { notFound: true };
      saveGeoCache();
      return null;
    }
  } catch (err) {
    console.warn(`Geocoding fetch failed for "${placeName}":`, err);
    return null;
  }
}

/**
 * Render Leaflet map into containerEl
 */
export async function renderMap(containerEl, spec, isDark = false) {
  if (typeof window.L === 'undefined') {
    throw new Error('Leaflet library is not loaded');
  }

  // Ensure Leaflet marker asset paths are resolved locally
  delete window.L.Icon.Default.prototype._getIconUrl;
  window.L.Icon.Default.mergeOptions({
    iconRetinaUrl: './vendor/images/marker-icon-2x.png',
    iconUrl: './vendor/images/marker-icon.png',
    shadowUrl: './vendor/images/marker-shadow.png'
  });

  let config = spec;
  if (typeof spec === 'string') {
    try {
      config = JSON.parse(spec);
    } catch {
      throw new Error('Invalid JSON format inside map block.');
    }
  }

  const places = config.places || [];
  if (!Array.isArray(places) || places.length === 0) {
    throw new Error('Map block must specify a "places" array with at least one place.');
  }

  const map = window.L.map(containerEl, {
    zoomControl: true,
    scrollWheelZoom: false
  });

  // OpenStreetMap tile layer (with crossOrigin: true for canvas export safety)
  const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tiles = window.L.tileLayer(tileUrl, {
    maxZoom: 18,
    crossOrigin: true,
    attribution: '&copy; OpenStreetMap contributors'
  });
  tiles.addTo(map);

  const markers = [];
  const warnings = [];

  for (const p of places) {
    const name = typeof p === 'string' ? p : p.name;
    const note = p.note || '';

    if (!name) continue;

    const geo = await geocodePlace(name);
    if (geo && !geo.notFound) {
      const marker = window.L.marker([geo.lat, geo.lon]);
      const popupHtml = `
        <div style="font-family: system-ui; font-size: 13px; line-height: 1.4;">
          <strong>${name}</strong>
          ${note ? `<p style="margin-top: 4px; color: #525866;">${note}</p>` : ''}
        </div>
      `;
      marker.bindPopup(popupHtml);
      marker.addTo(map);
      markers.push([geo.lat, geo.lon]);
    } else {
      warnings.push(`Place not found: "${name}"`);
    }
  }

  if (markers.length > 0) {
    if (markers.length === 1) {
      map.setView(markers[0], 12);
    } else {
      const bounds = window.L.latLngBounds(markers);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  } else {
    map.setView([20, 0], 2);
  }

  // Force map invalidation on load so tiles render fully
  setTimeout(() => map.invalidateSize(), 200);

  return { map, warnings };
}
