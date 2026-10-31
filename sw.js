const CACHE_NAME = 'formattingbuddy-v5';

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
  './js/db.js',
  './js/ocr.js',
  './js/workers/parse-worker.js',
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
  './vendor/pdf.min.mjs',
  './vendor/pdf.worker.min.mjs',
  './vendor/mammoth.browser.min.js',
  './vendor/xlsx.full.min.js',
  './vendor/tesseract.min.js',
  './vendor/tesseract-worker.min.js',
  './vendor/tesseract-core.wasm.js',
  './vendor/tesseract-core-simd.wasm',
  './vendor/tesseract-core.wasm',
  './vendor/fonts/NotoSans-Regular.ttf',
  './vendor/fonts/NotoSansDevanagari-Regular.ttf',
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

  // For AI provider calls (Gemini, Groq, OpenRouter, etc.), never cache or intercept with cache
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

  // Tessdata language data caching for offline OCR support
  if (url.hostname.includes('tessdata.projectnaptha.com')) {
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

  // Same-origin dynamic assets (HTML, js, css, wasm): Network First with Cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Default: Cache first with Network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
      );
    })
  );
});
