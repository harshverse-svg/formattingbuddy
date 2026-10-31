/**
 * FormattingBuddy - Wallpaper & Appearance Engine (Stage D)
 * Manages photo themes, floating glass card layout, opacity, blur, accents, and custom wallpaper uploads.
 */

import { saveUserWallpaper, getUserWallpaper, deleteUserWallpaper } from './db.js';

const STORAGE_KEY_APPEARANCE = 'formattingbuddy_appearance_v1';

export const BUNDLED_WALLPAPERS = [
  { id: 'mist-mountains', name: 'Mist & Mountains', thumb: './assets/wallpapers/mist-mountains-thumb.webp', full: './assets/wallpapers/mist-mountains.webp', mobile: './assets/wallpapers/mist-mountains-mobile.webp' },
  { id: 'deep-forest', name: 'Deep Forest', thumb: './assets/wallpapers/deep-forest-thumb.webp', full: './assets/wallpapers/deep-forest.webp', mobile: './assets/wallpapers/deep-forest-mobile.webp' },
  { id: 'calm-ocean', name: 'Calm Ocean', thumb: './assets/wallpapers/calm-ocean-thumb.webp', full: './assets/wallpapers/calm-ocean.webp', mobile: './assets/wallpapers/calm-ocean-mobile.webp' },
  { id: 'desert-dune', name: 'Desert Dunes', thumb: './assets/wallpapers/desert-dune-thumb.webp', full: './assets/wallpapers/desert-dune.webp', mobile: './assets/wallpapers/desert-dune-mobile.webp' },
  { id: 'nocturne-aurora', name: 'Nocturne Aurora', thumb: './assets/wallpapers/nocturne-aurora-thumb.webp', full: './assets/wallpapers/nocturne-aurora.webp', mobile: './assets/wallpapers/nocturne-aurora-mobile.webp' },
  { id: 'architectural-minimal', name: 'Architectural Minimal', thumb: './assets/wallpapers/architectural-minimal-thumb.webp', full: './assets/wallpapers/architectural-minimal.webp', mobile: './assets/wallpapers/architectural-minimal-mobile.webp' },
  { id: 'golden-coast', name: 'Golden Coast', thumb: './assets/wallpapers/golden-coast-thumb.webp', full: './assets/wallpapers/golden-coast.webp', mobile: './assets/wallpapers/golden-coast-mobile.webp' },
  { id: 'paper-texture', name: 'Studio Slate', thumb: './assets/wallpapers/paper-texture-thumb.webp', full: './assets/wallpapers/paper-texture.webp', mobile: './assets/wallpapers/paper-texture-mobile.webp' }
];

export const ACCENT_PRESETS = [
  { name: 'Indigo', value: '#4F5BD5' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Sky', value: '#0284C7' },
  { name: 'Amber', value: '#D97706' },
  { name: 'Rose', value: '#E11D48' },
  { name: 'Violet', value: '#7C3AED' }
];

class WallpaperManager {
  constructor() {
    this.config = this.loadConfig();
    this.customWallpaperUrl = null;
    this.bgContainer = null;
    this.overlayContainer = null;
  }

  loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_APPEARANCE);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed loading appearance config:', e);
    }
    return {
      wallpaper: 'none', // 'none' | bundled ID | 'custom'
      backgroundDim: 35, // 0 to 80%
      panelOpacity: 88,  // 50 to 100%
      accentColor: '#4F5BD5',
      glassBlur: false,  // Off by default for high performance / low CPU
      lowPowerMode: false
    };
  }

  saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY_APPEARANCE, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed saving appearance config:', e);
    }
  }

  async init() {
    this.ensureDomElements();
    this.customWallpaperUrl = await getUserWallpaper();
    this.applySettings();
  }

  ensureDomElements() {
    if (!document.getElementById('fb-wallpaper-layer')) {
      const layer = document.createElement('div');
      layer.id = 'fb-wallpaper-layer';
      layer.className = 'fb-wallpaper-layer';

      const bg = document.createElement('div');
      bg.id = 'fb-wallpaper-bg';
      bg.className = 'fb-wallpaper-bg';

      const overlay = document.createElement('div');
      overlay.id = 'fb-wallpaper-overlay';
      overlay.className = 'fb-wallpaper-overlay';

      layer.appendChild(bg);
      layer.appendChild(overlay);
      document.body.prepend(layer);

      this.bgContainer = bg;
      this.overlayContainer = overlay;
    } else {
      this.bgContainer = document.getElementById('fb-wallpaper-bg');
      this.overlayContainer = document.getElementById('fb-wallpaper-overlay');
    }
  }

  applySettings() {
    const { wallpaper, backgroundDim, panelOpacity, accentColor, glassBlur, lowPowerMode } = this.config;
    const body = document.body;

    // 1. Accent color application
    if (accentColor) {
      document.documentElement.style.setProperty('--accent', accentColor);
      document.documentElement.style.setProperty('--accent-glow', `${accentColor}55`);
    }

    // 2. Low power mode
    if (lowPowerMode) {
      body.classList.add('low-power-mode');
    } else {
      body.classList.remove('low-power-mode');
    }

    // 3. Wallpaper rendering
    if (wallpaper === 'none') {
      body.classList.remove('has-wallpaper');
      body.classList.remove('has-glass-blur');
      if (this.bgContainer) {
        this.bgContainer.style.backgroundImage = 'none';
        this.bgContainer.style.opacity = '0';
      }
      if (this.overlayContainer) {
        this.overlayContainer.style.opacity = '0';
      }
      document.documentElement.style.removeProperty('--glass-surface-opacity');
      return;
    }

    body.classList.add('has-wallpaper');

    if (glassBlur && !lowPowerMode) {
      body.classList.add('has-glass-blur');
    } else {
      body.classList.remove('has-glass-blur');
    }

    // Set panel opacity CSS variable
    const opVal = Math.min(Math.max(panelOpacity, 50), 100) / 100;
    document.documentElement.style.setProperty('--glass-surface-opacity', opVal.toString());

    // Dim overlay
    const dimVal = Math.min(Math.max(backgroundDim, 0), 85) / 100;
    if (this.overlayContainer) {
      this.overlayContainer.style.backgroundColor = `rgba(0, 0, 0, ${dimVal})`;
      this.overlayContainer.style.opacity = '1';
    }

    // Image source
    let imgSrc = '';
    const isMobile = window.innerWidth <= 768;

    if (wallpaper === 'custom') {
      imgSrc = this.customWallpaperUrl || '';
    } else {
      const match = BUNDLED_WALLPAPERS.find(w => w.id === wallpaper);
      if (match) {
        imgSrc = isMobile ? match.mobile : match.full;
      }
    }

    if (this.bgContainer && imgSrc) {
      // Smooth crossfade
      this.bgContainer.style.opacity = '0';
      const img = new Image();
      img.onload = () => {
        this.bgContainer.style.backgroundImage = `url("${imgSrc}")`;
        this.bgContainer.style.opacity = '1';
      };
      img.src = imgSrc;
    }
  }

  setWallpaper(id) {
    this.config.wallpaper = id;
    this.saveConfig();
    this.applySettings();
  }

  setBackgroundDim(dimPercent) {
    this.config.backgroundDim = parseInt(dimPercent, 10);
    this.saveConfig();
    this.applySettings();
  }

  setPanelOpacity(opacityPercent) {
    this.config.panelOpacity = parseInt(opacityPercent, 10);
    this.saveConfig();
    this.applySettings();
  }

  setAccentColor(color) {
    this.config.accentColor = color;
    this.saveConfig();
    this.applySettings();
  }

  setGlassBlur(enabled) {
    this.config.glassBlur = !!enabled;
    this.saveConfig();
    this.applySettings();
  }

  setLowPowerMode(enabled) {
    this.config.lowPowerMode = !!enabled;
    this.saveConfig();
    this.applySettings();
  }

  async uploadCustomWallpaper(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image file exceeds the 5 MB limit.');
    }

    // Resize in browser via offscreen canvas to max 1920x1080 WebP
    const dataUrl = await this.resizeImageToDataUrl(file, 1920, 1080);
    await saveUserWallpaper(dataUrl);
    this.customWallpaperUrl = dataUrl;
    this.config.wallpaper = 'custom';
    this.saveConfig();
    this.applySettings();
  }

  async removeCustomWallpaper() {
    await deleteUserWallpaper();
    this.customWallpaperUrl = null;
    this.config.wallpaper = 'none';
    this.saveConfig();
    this.applySettings();
  }

  resizeImageToDataUrl(file, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          if (h > maxHeight) {
            w = Math.round((w * maxHeight) / h);
            h = maxHeight;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/webp', 0.85));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export const wallpaperManager = new WallpaperManager();
