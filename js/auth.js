/**
 * FormattingBuddy - Local Auth & Inactivity Manager
 */
import { generateSalt, hashPasscode, deriveEncryptionKey } from './crypto.js';

const STORAGE_KEY_AUTH = 'formattingbuddy_auth_v1';
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

class AuthManager {
  constructor() {
    this.derivedKey = null;
    this.isAuthenticated = false;
    this.inactivityTimer = null;
    this.listeners = new Set();
    this.bindActivityListeners();
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb({
        isSetup: this.isConfigured(),
        isAuthenticated: this.isAuthenticated,
        hasKey: !!this.derivedKey
      });
    }
  }

  isConfigured() {
    return !!localStorage.getItem(STORAGE_KEY_AUTH);
  }

  getAuthRecord() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUTH);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async setupPasscode(passcode) {
    if (!passcode || passcode.trim().length < 4) {
      throw new Error('Passcode must be at least 4 characters long.');
    }
    const salt = generateSalt();
    const hash = await hashPasscode(passcode, salt);
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({ salt, hash }));

    // Derive active session encryption key
    this.derivedKey = await deriveEncryptionKey(passcode, salt);
    this.isAuthenticated = true;
    this.resetInactivityTimer();
    this.notify();
    return this.derivedKey;
  }

  async unlock(passcode) {
    const record = this.getAuthRecord();
    if (!record || !record.salt || !record.hash) {
      throw new Error('No passcode configured. Please set up a passcode.');
    }
    const checkHash = await hashPasscode(passcode, record.salt);
    if (checkHash !== record.hash) {
      throw new Error('Incorrect passcode. Please try again.');
    }
    this.derivedKey = await deriveEncryptionKey(passcode, record.salt);
    this.isAuthenticated = true;
    this.resetInactivityTimer();
    this.notify();
    return this.derivedKey;
  }

  lock() {
    this.derivedKey = null;
    this.isAuthenticated = false;
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    this.notify();
  }

  async resetApp() {
    this.lock();
    localStorage.clear();
    sessionStorage.clear();
    if (window.indexedDB) {
      try {
        window.indexedDB.deleteDatabase('formattingbuddy_db_v1');
      } catch (err) {
        console.warn('Failed to delete indexedDB:', err);
      }
    }
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (err) {
        console.warn('Failed to clear cache storage:', err);
      }
    }
    window.location.reload();
  }

  resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    if (!this.isAuthenticated) return;

    this.inactivityTimer = setTimeout(() => {
      console.info('Auto-locking FormattingBuddy due to 15 minutes of inactivity.');
      this.lock();
    }, INACTIVITY_TIMEOUT_MS);
  }

  bindActivityListeners() {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => {
      if (this.isAuthenticated) {
        this.resetInactivityTimer();
      }
    };
    events.forEach((evt) => {
      window.addEventListener(evt, handleActivity, { passive: true });
    });
  }

  getActiveKey() {
    return this.derivedKey;
  }
}

export const auth = new AuthManager();

