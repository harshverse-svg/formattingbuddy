const CACHE_NAME = 'formattingbuddy-v4';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './manifest.json',
  './css/main.css',
  './js/app.js',
  './js/crypto.js',
  './js/auth.js',
  './js/state.js',
  './js/providers.js',
  './js/chunker.js',
  './js/markdown.js',
  './js/samples.js',
  './js/blocks/mermaid.js',
  './js/blocks/charts.js',
  './js/blocks/maps.js',
  './js/export/html.js',
  './js/export/markdown.js',
  './js/export/pdf.js',
  './js/export/docx.js',
  './js/export/zip.js',
  './vendor/mermaid.min.js',
  './vendor/chart.umd.min.js',
  './vendor/leaflet.js',
  './vendor/leaflet.css',
  './vendor/images/marker-icon.png',
  './vendor/images/marker-icon-2x.png',
  './vendor/images/marker-shadow.png',
  './vendor/marked.umd.js',
  './vendor/docx.iife.js',
  './vendor/jspdf.umd.min.js',
  './vendor/html2canvas.min.js',
  './vendor/jszip.min.js',
  './assets/icons/icon.svg',
  './assets/icons/wordmark.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For API provider calls (Gemini, Groq, OpenRouter, etc.), never cache or intercept with cache
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('groq.com') ||
    url.hostname.includes('openrouter.ai') ||
    url.hostname.includes('mistral.ai') ||
    url.hostname.includes('ollama.com') ||
    url.hostname.includes('huggingface.co') ||
    url.hostname.includes('anthropic.com')
  ) {
    return;
  }

  // OpenStreetMap tile caching for offline map support
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Same-origin dynamic assets (HTML, js, css): Network First with Cache fallback
  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/vendor/') || url.pathname.includes('/assets/')) {
      // Static vendor assets: Cache First
      event.respondWith(
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return res;
          });
        })
      );
    } else {
      // Application scripts, styles, and HTML: Network First
      event.respondWith(
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => caches.match(event.request))
      );
    }
  }
});
