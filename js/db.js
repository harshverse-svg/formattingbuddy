/**
 * FormattingBuddy - IndexedDB Storage & Chunk Cache Manager
 * Handles persistent file storage, OCR page caching, and SHA-256 chunk caching.
 */

const DB_NAME = 'formattingbuddy_db_v1';
const DB_VERSION = 2;

let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Files Store
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('createdAt', 'createdAt', { unique: false });
        fileStore.createIndex('name', 'name', { unique: false });
      }

      // 2. Chunks Cache (Key: SHA-256 of chunk text)
      if (!db.objectStoreNames.contains('chunks_cache')) {
        db.createObjectStore('chunks_cache', { keyPath: 'hash' });
      }

      // 3. OCR Cache (Key: docId_pageNum)
      if (!db.objectStoreNames.contains('ocr_cache')) {
        db.createObjectStore('ocr_cache', { keyPath: 'key' });
      }

      // 4. User Wallpaper Store (Stage D)
      if (!db.objectStoreNames.contains('user_wallpapers')) {
        db.createObjectStore('user_wallpapers', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });

  return dbPromise;
}

/**
 * Computes a SHA-256 hex hash of any string using Web Crypto
 */
export async function computeHash(text) {
  const enc = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', enc.encode(text.trim()));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ==========================================================================
   Files Operations
   ========================================================================== */
export async function saveParsedFile(record) {
  const db = await openDatabase();
  const tx = db.transaction('files', 'readwrite');
  const store = tx.objectStore('files');
  const id = record.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item = {
    ...record,
    id,
    createdAt: Date.now()
  };
  await new Promise((resolve, reject) => {
    const req = store.put(item);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
  });
  return item;
}

export async function getStoredFiles() {
  const db = await openDatabase();
  const tx = db.transaction('files', 'readonly');
  const store = tx.objectStore('files');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStoredFile(id) {
  const db = await openDatabase();
  const tx = db.transaction('files', 'readwrite');
  const store = tx.objectStore('files');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllStoredFiles() {
  const db = await openDatabase();
  const tx = db.transaction(['files', 'chunks_cache', 'ocr_cache'], 'readwrite');
  return new Promise((resolve, reject) => {
    tx.objectStore('files').clear();
    tx.objectStore('chunks_cache').clear();
    tx.objectStore('ocr_cache').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStorageStats() {
  const db = await openDatabase();
  const tx = db.transaction(['files', 'chunks_cache', 'ocr_cache'], 'readonly');
  
  const count = (storeName) => new Promise((resolve) => {
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });

  const [filesCount, chunksCount, ocrCount] = await Promise.all([
    count('files'),
    count('chunks_cache'),
    count('ocr_cache')
  ]);

  let estimatedBytes = 0;
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      estimatedBytes = estimate.usage || 0;
    } catch {
      estimatedBytes = 0;
    }
  }

  return {
    filesCount,
    chunksCount,
    ocrCount,
    estimatedBytes
  };
}

/* ==========================================================================
   Chunk Cache (Prevents repeating finished work across retries or model switches)
   ========================================================================== */
export async function getCachedChunk(text) {
  try {
    const hash = await computeHash(text);
    const db = await openDatabase();
    const tx = db.transaction('chunks_cache', 'readonly');
    const store = tx.objectStore('chunks_cache');
    return new Promise((resolve) => {
      const req = store.get(hash);
      req.onsuccess = () => resolve(req.result ? req.result.formattedMarkdown : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedChunk(text, formattedMarkdown, provider = '', model = '') {
  try {
    const hash = await computeHash(text);
    const db = await openDatabase();
    const tx = db.transaction('chunks_cache', 'readwrite');
    const store = tx.objectStore('chunks_cache');
    return new Promise((resolve) => {
      const req = store.put({
        hash,
        textLength: text.length,
        formattedMarkdown,
        provider,
        model,
        createdAt: Date.now()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (e) {
    console.warn('Failed saving chunk to cache:', e);
  }
}

/* ==========================================================================
   OCR Page Cache
   ========================================================================== */
export async function getCachedOcrPage(docId, pageNum) {
  try {
    const key = `${docId}_p${pageNum}`;
    const db = await openDatabase();
    const tx = db.transaction('ocr_cache', 'readonly');
    const store = tx.objectStore('ocr_cache');
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.text : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedOcrPage(docId, pageNum, text, mode = 'local') {
  try {
    const key = `${docId}_p${pageNum}`;
    const db = await openDatabase();
    const tx = db.transaction('ocr_cache', 'readwrite');
    const store = tx.objectStore('ocr_cache');
    return new Promise((resolve) => {
      const req = store.put({
        key,
        docId,
        pageNum,
        text,
        mode,
        createdAt: Date.now()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (e) {
    console.warn('Failed saving OCR page to cache:', e);
  }
}

/* ==========================================================================
   User Custom Wallpaper Operations (Stage D)
   ========================================================================== */
export async function saveUserWallpaper(dataUrl) {
  try {
    const db = await openDatabase();
    const tx = db.transaction('user_wallpapers', 'readwrite');
    const store = tx.objectStore('user_wallpapers');
    return new Promise((resolve, reject) => {
      const req = store.put({ id: 'custom_wallpaper', dataUrl, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn('Failed saving custom wallpaper:', err);
    throw err;
  }
}

export async function getUserWallpaper() {
  try {
    const db = await openDatabase();
    const tx = db.transaction('user_wallpapers', 'readonly');
    const store = tx.objectStore('user_wallpapers');
    return new Promise((resolve) => {
      const req = store.get('custom_wallpaper');
      req.onsuccess = () => resolve(req.result ? req.result.dataUrl : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteUserWallpaper() {
  try {
    const db = await openDatabase();
    const tx = db.transaction('user_wallpapers', 'readwrite');
    const store = tx.objectStore('user_wallpapers');
    return new Promise((resolve) => {
      const req = store.delete('custom_wallpaper');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (e) {
    console.warn('Failed deleting custom wallpaper:', e);
  }
}
