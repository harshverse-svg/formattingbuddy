/**
 * FormattingBuddy - Main Application Controller
 * Minimal, modern static PWA with zero backend.
 */
import { auth } from './auth.js';
import { state } from './state.js';
import { providers, PROVIDER_DEFS } from './providers.js';
import { ConversionPipeline, countWords, chunkText } from './chunker.js';
import { renderDocumentToElement, extractToc } from './markdown.js';
import { exportToSelfContainedHtml } from './export/html.js';
import { exportToMarkdown } from './export/markdown.js';
import { exportToPdf, exportViaPrintIframe, copyExportDiagnostic } from './export/pdf.js';
import { exportToDocx } from './export/docx.js';
import { exportToZip } from './export/zip.js';
import { SAMPLES } from './samples.js';
import { saveParsedFile, getStorageStats, clearAllStoredFiles } from './db.js';
import { OcrRunner } from './ocr.js';
import { getHistory, saveToHistory, deleteHistoryItem, clearHistory } from './history.js';
import * as pdfjsLib from '../vendor/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

let activePipeline = null;
let deferredInstallPrompt = null;
let pendingFileObject = null;
let pendingFileBuffer = null;
let pendingParsedResult = null;
let pendingPdfDoc = null;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initSplash();
  initPwa();
  initTheme();
  initAuthUI();
  initSettingsUI();
  initOnboardingUI();
  initHelpUI();
  initStatusBarUI();
  initEmptyStateUI();
  initEditorUI();
  initEstimatorUI();
  initOcrUI();
  initExportUI();
  initSamplesUI();
  initHistoryUI();
  restoreState();
});

/* ==========================================================================
   0. Splash Screen (Stage 2: 1s, 1x per session, skipped on reduced motion)
   ========================================================================== */
function initSplash() {
  const splash = document.getElementById('fb-splash');
  if (!splash) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const alreadyShown = sessionStorage.getItem('fb_splash_shown');

  if (reducedMotion || alreadyShown) {
    splash.remove();
    return;
  }

  sessionStorage.setItem('fb_splash_shown', 'true');
  setTimeout(() => {
    splash.classList.add('splash-fade-out');
    setTimeout(() => {
      splash.remove();
    }, 260);
  }, 1000);
}

/* ==========================================================================
   1. PWA & Service Worker
   ========================================================================== */
function initPwa() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('FormattingBuddy SW registered:', reg.scope);
        // Detect updates per deploy
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              const banner = document.getElementById('update-banner');
              if (banner) banner.style.display = 'flex';
            }
          });
        });
      }).catch((err) => {
        console.warn('FormattingBuddy SW registration failed:', err);
      });
    });
  }

  const reloadUpdateBtn = document.getElementById('btn-reload-update');
  if (reloadUpdateBtn) {
    reloadUpdateBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  const installBtn = document.getElementById('btn-install-app');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-flex';
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        installBtn.style.display = 'none';
      }
      deferredInstallPrompt = null;
    });
  }

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.style.display = 'none';
    showToast('FormattingBuddy installed successfully!', 'success');
  });
}

/* ==========================================================================
   2. Theme Switcher (3 Themes: Light Soft Blue, Dark Midnight, Slate)
   ========================================================================== */
function initTheme() {
  const currentTheme = state.getTheme();
  state.setTheme(currentTheme);

  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  if (themeToggleBtn) {
    updateThemeIcon(themeToggleBtn, currentTheme);
    themeToggleBtn.addEventListener('click', () => {
      const active = state.getTheme();
      // Cycle: light -> dark -> slate -> light
      const next = active === 'light' ? 'dark' : (active === 'dark' ? 'slate' : 'light');
      state.setTheme(next);
      updateThemeIcon(themeToggleBtn, next);
      showToast(`Switched theme to ${getThemeLabel(next)}`, 'info');
      // Re-render current document to update diagram & chart colors
      const currentMd = state.get().markdownOutput;
      if (currentMd) {
        renderPreview(currentMd);
      }
    });
  }
}

function getThemeLabel(theme) {
  if (theme === 'dark') return 'Midnight (Dark)';
  if (theme === 'slate') return 'Slate (Gray-Blue)';
  return 'Soft Blue (Light)';
}

function updateThemeIcon(btn, theme) {
  const label = getThemeLabel(theme);
  btn.setAttribute('aria-label', `Theme: ${label}. Click to cycle.`);
  btn.setAttribute('title', `Theme: ${label} (Click to switch)`);

  if (theme === 'dark') {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  } else if (theme === 'slate') {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;
  } else {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  }
}

/* ==========================================================================
   3. Auth & Passcode Modal (Stage 1)
   ========================================================================== */
function initAuthUI() {
  const modal = document.getElementById('modal-auth');
  const titleEl = document.getElementById('auth-modal-title');
  const descEl = document.getElementById('auth-modal-desc');
  const passcodeField = document.getElementById('auth-passcode');
  const confirmGroup = document.getElementById('auth-confirm-group');
  const confirmField = document.getElementById('auth-confirm-passcode');
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');
  const lockBtn = document.getElementById('btn-lock-app');
  const resetBtn = document.getElementById('btn-reset-app');

  function showAuthModal(isFirstSetup) {
    modal.classList.add('active');
    passcodeField.value = '';
    confirmField.value = '';
    errorEl.textContent = '';
    errorEl.style.display = 'none';

    if (isFirstSetup) {
      titleEl.textContent = 'Create Passcode';
      descEl.textContent = 'Create a passcode to encrypt your API keys and drafts locally. This passcode protects data on this device only.';
      confirmGroup.style.display = 'flex';
      submitBtn.textContent = 'Set Passcode & Unlock';
    } else {
      titleEl.textContent = 'Unlock FormattingBuddy';
      descEl.textContent = 'Enter your device passcode to decrypt your API keys and local workspace. This passcode protects data on this device only.';
      confirmGroup.style.display = 'none';
      submitBtn.textContent = 'Unlock Workspace';
    }
    setTimeout(() => passcodeField.focus(), 100);
  }

  function hideAuthModal() {
    modal.classList.remove('active');
  }

  submitBtn.addEventListener('click', async () => {
    const isFirstSetup = !auth.isConfigured();
    const val = passcodeField.value;
    errorEl.textContent = '';
    errorEl.style.display = 'none';

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      if (isFirstSetup) {
        const conf = confirmField.value;
        if (val !== conf) {
          throw new Error('Passcodes do not match.');
        }
        const derivedKey = await auth.setupPasscode(val);
        await providers.loadDecryptedKeys(derivedKey);
        hideAuthModal();
        showToast('Passcode created and workspace unlocked.', 'success');
        checkFirstRunOnboarding();
      } else {
        const derivedKey = await auth.unlock(val);
        await providers.loadDecryptedKeys(derivedKey);
        hideAuthModal();
        showToast('Workspace unlocked.', 'success');
        checkFirstRunOnboarding();
      }
      updateStatusBarStorage();
      updateStatusBarProvider();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isFirstSetup ? 'Set Passcode & Unlock' : 'Unlock Workspace';
    }
  });

  passcodeField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn.click();
  });
  confirmField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn.click();
  });

  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      auth.lock();
      showToast('FormattingBuddy locked.', 'info');
      showAuthModal(false);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const confirmed = window.confirm(
        'Warning: "Reset App" will completely wipe your local passcode, all stored API keys, and your autosaved drafts and files from this device. Are you sure?'
      );
      if (confirmed) {
        await clearAllStoredFiles();
        auth.resetApp();
      }
    });
  }

  // Check auth state on start
  if (!auth.isConfigured()) {
    showAuthModal(true);
  } else if (!auth.isAuthenticated) {
    showAuthModal(false);
  }
}

/* ==========================================================================
   4. Onboarding & Help UI (Stage 3)
   ========================================================================== */
function initOnboardingUI() {
  const modal = document.getElementById('modal-welcome');
  const startBtn = document.getElementById('btn-welcome-start');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      localStorage.setItem('fb_onboarding_done', 'true');
      modal.classList.remove('active');

      const enabled = providers.getEnabledProviders();
      if (enabled.length === 0) {
        showToast('Add your first API key in Settings to begin formatting.', 'info');
        document.getElementById('btn-open-settings')?.click();
      }
    });
  }
}

function checkFirstRunOnboarding() {
  const done = localStorage.getItem('fb_onboarding_done');
  if (!done) {
    const modal = document.getElementById('modal-welcome');
    if (modal) modal.classList.add('active');
  }
}

function initHelpUI() {
  const modal = document.getElementById('modal-help');
  const openBtn = document.getElementById('btn-open-help');
  const closeBtn = document.getElementById('btn-close-help');
  const doneBtn = document.getElementById('btn-help-done');
  const reportBtn = document.getElementById('btn-report-export-problem');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => modal.classList.add('active'));
  }
  const close = () => modal && modal.classList.remove('active');
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (doneBtn) doneBtn.addEventListener('click', close);

  if (reportBtn) {
    reportBtn.addEventListener('click', async () => {
      const ok = await copyExportDiagnostic();
      if (ok) {
        showToast('Export diagnostic log copied to clipboard.', 'success');
      } else {
        showToast('Unable to copy diagnostic log to clipboard.', 'warning');
      }
    });
  }
}

/* ==========================================================================
   5. Persistent Status Bar & Storage UI (Stage 3)
   ========================================================================== */
function initStatusBarUI() {
  const clearBtn = document.getElementById('btn-clear-storage');

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const confirmed = window.confirm('Clear all stored files and cached chunk results? This frees local storage.');
      if (confirmed) {
        await clearAllStoredFiles();
        showToast('Storage cleared.', 'info');
        updateStatusBarStorage();
      }
    });
  }

  updateStatusBarStorage();
  updateStatusBarProvider();
}

async function updateStatusBarStorage() {
  const storageEl = document.getElementById('status-bar-storage');
  if (!storageEl) return;

  try {
    const stats = await getStorageStats();
    const mbUsed = (stats.estimatedBytes / (1024 * 1024)).toFixed(1);
    const sizeStr = stats.estimatedBytes > 0 ? ` (${mbUsed} MB)` : '';
    storageEl.textContent = `Storage: ${stats.filesCount} file${stats.filesCount === 1 ? '' : 's'}, ${stats.chunksCount} cached section${stats.chunksCount === 1 ? '' : 's'}${sizeStr}`;
  } catch {
    storageEl.textContent = 'Storage: Local IndexedDB ready';
  }
}

function updateStatusBarProvider() {
  const providerEl = document.getElementById('status-bar-provider');
  if (!providerEl) return;

  const currentChoice = state.get().provider || 'auto';
  if (currentChoice === 'auto') {
    const enabled = providers.getEnabledProviders();
    providerEl.textContent = `Provider: Auto fallback (${enabled.length} ready)`;
  } else {
    const def = PROVIDER_DEFS[currentChoice];
    const s = providers.getSettings(currentChoice);
    const name = def ? def.name : currentChoice;
    const model = s.model ? ` (${s.model})` : '';
    providerEl.textContent = `Provider: ${name}${model}`;
  }
}

/* ==========================================================================
   6. Empty State in Preview (Stage 3)
   ========================================================================== */
function initEmptyStateUI() {
  const emptySampleBtn = document.getElementById('btn-empty-sample');
  if (emptySampleBtn) {
    emptySampleBtn.addEventListener('click', () => {
      const processItem = document.querySelector('[data-sample-id="process"]');
      if (processItem) processItem.click();
    });
  }
}

/* ==========================================================================
   7. Settings & API Key Manager (Stage 2)
   ========================================================================== */
function initSettingsUI() {
  const modal = document.getElementById('modal-settings');
  const openBtn = document.getElementById('btn-open-settings');
  const closeBtn = document.getElementById('btn-close-settings');
  const doneBtn = document.getElementById('btn-done-settings');
  const container = document.getElementById('settings-providers-container');

  openBtn.addEventListener('click', () => {
    if (!auth.isAuthenticated) {
      showToast('Please unlock the app to access Settings.', 'warning');
      return;
    }
    renderProviderCards();
    modal.classList.add('active');
  });

  const closeModal = () => {
    modal.classList.remove('active');
    updateProviderSelectDropdown();
    updateStatusBarProvider();
  };

  closeBtn.addEventListener('click', closeModal);
  if (doneBtn) doneBtn.addEventListener('click', closeModal);

  function renderProviderCards() {
    container.innerHTML = '';

    for (const id in PROVIDER_DEFS) {
      const def = PROVIDER_DEFS[id];
      const s = providers.getSettings(id);
      const currentKey = providers.getKey(id);

      const card = document.createElement('div');
      card.className = 'provider-card';

      card.innerHTML = `
        <div class="provider-card-header">
          <div class="provider-info">
            <span class="provider-name">${def.name}</span>
            <span class="provider-badge">${def.badge}</span>
          </div>
          <label class="provider-switch">
            <input type="checkbox" id="enable-${id}" ${s.enabled ? 'checked' : ''}>
            <span>Enable</span>
          </label>
        </div>

        <div class="provider-fields">
          ${def.needsBaseUrl ? `
            <div class="input-row">
              <input type="text" class="text-input" id="baseurl-${id}" placeholder="Base URL" value="${escapeHtml(s.baseUrl || def.defaultBaseUrl || '')}">
            </div>
          ` : ''}

          <div class="input-row">
            <input type="password" class="text-input" id="key-${id}" placeholder="Enter API Key" value="${escapeHtml(currentKey)}">
            <button class="btn btn-sm btn-outline" id="toggle-key-${id}" type="button">Show</button>
            <button class="btn btn-sm btn-outline" id="test-${id}" type="button">Test</button>
          </div>

          <div class="input-row" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap: wrap;">
              <span style="font-size:0.75rem; color:var(--text-muted);">Model:</span>
              <input type="text" class="text-input" style="height:28px; width:160px; font-size:0.8rem;" id="model-${id}" value="${escapeHtml(s.model || def.defaultModel)}" list="models-list-${id}" placeholder="Model ID">
              <datalist id="models-list-${id}"></datalist>
              <button class="btn btn-sm btn-outline" id="refresh-models-${id}" type="button" title="Refresh model list from provider">Refresh</button>
            </div>
            ${def.getKeyUrl ? `
              <a href="${def.getKeyUrl}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem; color:var(--accent); text-decoration:none;">Get a key &rarr;</a>
            ` : ''}
          </div>
          <div id="test-status-${id}" style="font-size:0.78rem; display:none;"></div>
        </div>
      `;

      container.appendChild(card);

      const enableCb = card.querySelector(`#enable-${id}`);
      const keyInput = card.querySelector(`#key-${id}`);
      const toggleKeyBtn = card.querySelector(`#toggle-key-${id}`);
      const modelInput = card.querySelector(`#model-${id}`);
      const testBtn = card.querySelector(`#test-${id}`);
      const statusEl = card.querySelector(`#test-status-${id}`);
      const baseUrlInput = card.querySelector(`#baseurl-${id}`);

      enableCb.addEventListener('change', () => {
        providers.updateSettings(id, { enabled: enableCb.checked });
        updateStatusBarProvider();
      });

      modelInput.addEventListener('change', () => {
        providers.updateSettings(id, { model: modelInput.value.trim() });
        updateStatusBarProvider();
      });

      const refreshBtn = card.querySelector(`#refresh-models-${id}`);
      const datalistEl = card.querySelector(`#models-list-${id}`);
      if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
          refreshBtn.disabled = true;
          refreshBtn.textContent = '...';
          try {
            const models = await providers.fetchAvailableModels(id);
            if (datalistEl) {
              datalistEl.innerHTML = '';
              models.forEach((m) => {
                const opt = document.createElement('option');
                opt.value = m;
                datalistEl.appendChild(opt);
              });
            }
            showToast(`Found ${models.length} model(s) for ${def.name}. Choose from list or edit freely.`, 'success');
          } catch (err) {
            showToast(`Failed loading models: ${err.message}`, 'error');
          } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Refresh';
          }
        });
      }

      if (baseUrlInput) {
        baseUrlInput.addEventListener('change', () => {
          providers.updateSettings(id, { baseUrl: baseUrlInput.value.trim() });
        });
      }

      keyInput.addEventListener('change', async () => {
        try {
          const cryptoKey = auth.getActiveKey();
          await providers.setKey(id, keyInput.value, cryptoKey);
          showToast(`Saved key for ${def.name}.`, 'success');
          updateStatusBarProvider();
        } catch (err) {
          showToast(`Failed saving key: ${err.message}`, 'error');
        }
      });

      toggleKeyBtn.addEventListener('click', () => {
        if (keyInput.type === 'password') {
          keyInput.type = 'text';
          toggleKeyBtn.textContent = 'Hide';
        } else {
          keyInput.type = 'password';
          toggleKeyBtn.textContent = 'Show';
        }
      });

      testBtn.addEventListener('click', async () => {
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        statusEl.style.display = 'block';
        statusEl.style.color = 'var(--text-muted)';
        statusEl.textContent = 'Connecting...';

        try {
          providers.updateSettings(id, {
            model: modelInput.value.trim(),
            baseUrl: baseUrlInput ? baseUrlInput.value.trim() : undefined
          });
          const cryptoKey = auth.getActiveKey();
          await providers.setKey(id, keyInput.value, cryptoKey);

          const result = await providers.testKey(id, keyInput.value);
          if (result.success) {
            statusEl.style.color = 'var(--success)';
            statusEl.textContent = `✓ ${result.message}`;
          } else {
            statusEl.style.color = 'var(--danger)';
            statusEl.textContent = `✗ ${result.message}`;
          }
        } catch (err) {
          statusEl.style.color = 'var(--danger)';
          statusEl.textContent = `✗ Error: ${err.message}`;
        } finally {
          testBtn.disabled = false;
          testBtn.textContent = 'Test';
        }
      });
    }
  }
}

function updateProviderSelectDropdown() {
  const select = document.getElementById('provider-select');
  if (!select) return;

  const currentChoice = state.get().provider;
  select.innerHTML = `<option value="auto">Auto (fallback)</option>`;

  for (const id in PROVIDER_DEFS) {
    const def = PROVIDER_DEFS[id];
    const s = providers.getSettings(id);
    const hasKey = providers.hasKey(id);

    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${def.name} ${hasKey ? '✓' : ''} ${!s.enabled ? '(Disabled)' : ''}`;
    select.appendChild(opt);
  }

  select.value = currentChoice || 'auto';
}

/* ==========================================================================
   8. Editor UI, 20 MB Web Worker Parser & Chunking (Stages 3 & 4)
   ========================================================================== */
function initEditorUI() {
  const textarea = document.getElementById('text-input');
  const wordCountEl = document.getElementById('word-count-badge');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('btn-browse-file');
  const convertBtn = document.getElementById('btn-convert');
  const cancelBtn = document.getElementById('btn-cancel-pipeline');
  const progressBox = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar-fill');
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  const providerSelect = document.getElementById('provider-select');
  const docTypeSelect = document.getElementById('select-doctype');
  const langSelect = document.getElementById('select-language');
  const diagramSelect = document.getElementById('select-diagram-level');

  // Mobile Tab switching
  const tabInputBtn = document.getElementById('tab-input');
  const tabPreviewBtn = document.getElementById('tab-preview');
  const panelInput = document.querySelector('.panel-input');
  const panelPreview = document.querySelector('.panel-preview');

  if (tabInputBtn && tabPreviewBtn) {
    tabInputBtn.addEventListener('click', () => {
      tabInputBtn.classList.add('active');
      tabPreviewBtn.classList.remove('active');
      panelInput.classList.add('active-tab');
      panelPreview.classList.remove('active-tab');
    });
    tabPreviewBtn.addEventListener('click', () => {
      tabPreviewBtn.classList.add('active');
      tabInputBtn.classList.remove('active');
      panelPreview.classList.add('active-tab');
      panelInput.classList.remove('active-tab');
    });
  }

  function updateWords() {
    const text = textarea.value;
    const words = countWords(text);
    wordCountEl.textContent = `${words.toLocaleString()} words`;
    state.set({ inputText: text });
    updateAutosaveIndicator('Saved locally');
  }

  textarea.addEventListener('input', updateWords);

  docTypeSelect.addEventListener('change', () => state.set({ docType: docTypeSelect.value }));
  langSelect.addEventListener('change', () => state.set({ language: langSelect.value }));
  diagramSelect.addEventListener('change', () => state.set({ diagramLevel: diagramSelect.value }));
  providerSelect.addEventListener('change', () => {
    state.set({ provider: providerSelect.value });
    updateStatusBarProvider();
  });

  // Multi-Format File drag & drop (up to 20 MB)
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleDocumentFile(e.target.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleDocumentFile(e.dataTransfer.files[0]);
    }
  });

  async function handleDocumentFile(file) {
    if (file.size > MAX_FILE_SIZE) {
      showToast('File size exceeds the 20 MB limit. Please select a smaller file.', 'error');
      return;
    }

    const nameLower = file.name.toLowerCase();
    if (nameLower.endsWith('.doc') || nameLower.endsWith('.ppt')) {
      showToast('Legacy .doc and .ppt formats are not supported. Please open the file in Word/PowerPoint and Save As .docx or .pptx.', 'error');
      return;
    }

    // Retain references for potential OCR
    pendingFileObject = file;

    // Show progress bar
    progressBox.classList.add('active');
    progressBar.style.width = '10%';
    progressText.textContent = `Reading ${file.name}...`;
    progressPercent.textContent = '10%';

    try {
      const arrayBuffer = await file.arrayBuffer();
      pendingFileBuffer = arrayBuffer;

      // Launch Web Worker parser
      const worker = new Worker('./js/workers/parse-worker.js', { type: 'module' });

      worker.onmessage = async (e) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          progressBar.style.width = `${msg.percent}%`;
          progressText.textContent = msg.status;
          progressPercent.textContent = `${msg.percent}%`;
        } else if (msg.type === 'complete') {
          worker.terminate();
          progressBox.classList.remove('active');

          const result = msg.result;
          pendingParsedResult = result;

          // If PDF or image has scanned pages needing OCR
          if (result.hasScannedPages) {
            promptOcrModal(file, result, arrayBuffer);
            return;
          }

          // Otherwise save document & update textarea
          textarea.value = result.text;
          updateWords();

          await saveParsedFile({
            name: file.name,
            size: file.size,
            type: file.type,
            text: result.text,
            pageCount: result.pageCount
          });

          await updateStatusBarStorage();
          showToast(`Parsed ${file.name}: ${result.pageCount} page(s), ${countWords(result.text)} words.`, 'success');

          // Open Estimator Dialog
          openEstimatorDialog(result.text, result.pageCount);
        } else if (msg.type === 'error') {
          worker.terminate();
          progressBox.classList.remove('active');
          showToast(`Failed to parse file: ${msg.message}`, 'error');
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        progressBox.classList.remove('active');
        showToast(`Worker error: ${err.message}`, 'error');
      };

      // Transfer ArrayBuffer to worker for zero-copy performance
      worker.postMessage({
        action: 'parse',
        fileData: arrayBuffer,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });
    } catch (err) {
      progressBox.classList.remove('active');
      showToast(`Error opening file: ${err.message}`, 'error');
    }
  }

  // Convert button opens the Pre-Conversion Estimator
  convertBtn.addEventListener('click', () => {
    if (!auth.isAuthenticated) {
      showToast('Please unlock the workspace first.', 'warning');
      return;
    }

    const text = textarea.value.trim();
    if (!text) {
      showToast('Please paste text or upload a document first.', 'warning');
      return;
    }

    const estimatedPages = Math.max(1, Math.ceil(countWords(text) / 400));
    openEstimatorDialog(text, estimatedPages);
  });

  cancelBtn.addEventListener('click', () => {
    if (activePipeline) {
      activePipeline.cancel();
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Cancelling...';
    }
  });
}

/* ==========================================================================
   9. Pre-Conversion Estimator (Stage 4)
   ========================================================================== */
function initEstimatorUI() {
  const modal = document.getElementById('modal-estimator');
  const closeBtn = document.getElementById('btn-close-estimator');
  const cancelBtn = document.getElementById('btn-estimator-cancel');
  const startBtn = document.getElementById('btn-estimator-start');
  const rangeSelect = document.getElementById('est-page-range');

  const close = () => modal.classList.remove('active');
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);

  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      close();
      const scope = rangeSelect.value;
      await runConversionPipeline(scope);
    });
  }
}

function openEstimatorDialog(text, pageCount = 1) {
  const modal = document.getElementById('modal-estimator');
  if (!modal) return;

  const chunks = chunkText(text);
  const totalChunks = Math.max(1, chunks.length);

  document.getElementById('est-pages-count').textContent = pageCount;
  document.getElementById('est-chunks-count').textContent = totalChunks;
  document.getElementById('est-calls-count').textContent = totalChunks;

  const warningEl = document.getElementById('est-large-warning');
  const warningCalls = document.getElementById('est-large-calls');

  if (totalChunks > 10) {
    warningEl.style.display = 'block';
    warningCalls.textContent = totalChunks;
  } else {
    warningEl.style.display = 'none';
  }

  modal.classList.add('active');
}

async function runConversionPipeline(scope = 'all') {
  const textarea = document.getElementById('text-input');
  const convertBtn = document.getElementById('btn-convert');
  const cancelBtn = document.getElementById('btn-cancel-pipeline');
  const progressBox = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar-fill');
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  const providerSelect = document.getElementById('provider-select');
  const docTypeSelect = document.getElementById('select-doctype');
  const langSelect = document.getElementById('select-language');
  const diagramSelect = document.getElementById('select-diagram-level');
  const tabPreviewBtn = document.getElementById('tab-preview');

  let textToProcess = textarea.value.trim();
  if (!textToProcess) return;

  // Apply scope filtering if user selected subset
  if (scope === 'first1') {
    const allChunks = chunkText(textToProcess);
    textToProcess = allChunks[0] || textToProcess;
  } else if (scope === 'first5') {
    const allChunks = chunkText(textToProcess);
    textToProcess = allChunks.slice(0, 5).join('\n\n');
  }

  // Switch to preview tab on mobile
  if (tabPreviewBtn && window.innerWidth <= 900) {
    tabPreviewBtn.click();
  }

  activePipeline = new ConversionPipeline({
    text: textToProcess,
    docType: docTypeSelect.value,
    language: langSelect.value,
    diagramLevel: diagramSelect.value,
    provider: providerSelect.value,
    onProgress: (p) => {
      progressBox.classList.add('active');
      progressBar.style.width = `${p.percent}%`;
      progressText.textContent = p.status;
      progressPercent.textContent = `${p.percent}%`;
    },
    onNotice: (notice) => {
      showToast(notice, 'warning');
    }
  });

  try {
    convertBtn.disabled = true;
    convertBtn.textContent = 'Formatting...';
    cancelBtn.style.display = 'inline-flex';
    progressBox.classList.add('active');

    const finalMarkdown = await activePipeline.run(0);
    state.set({ markdownOutput: finalMarkdown });
    saveToHistory({
      title: getDocumentTitle(),
      wordCount: countWords(finalMarkdown),
      docType: docTypeSelect.value,
      language: langSelect.value,
      markdown: finalMarkdown,
      rawText: textToProcess
    });
    await renderPreview(finalMarkdown);
    await updateStatusBarStorage();
    showToast('Document conversion completed!', 'success');
  } catch (err) {
    if (err.message && err.message.includes('cancelled')) {
      showToast('Conversion cancelled.', 'info');
    } else {
      showToast(`Conversion error: ${err.message}`, 'error');
      if (typeof err.failedChunkIndex === 'number') {
        showResumeOption(err.failedChunkIndex);
      }
    }
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = 'Convert';
    cancelBtn.style.display = 'none';
    setTimeout(() => progressBox.classList.remove('active'), 1500);
  }
}

function showResumeOption(failedIndex) {
  const progressText = document.getElementById('progress-text');
  progressText.innerHTML = `Failed at section ${failedIndex + 1}. <button id="btn-resume" class="btn btn-sm btn-outline" style="margin-left:8px;">Resume</button>`;
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', async () => {
      const convertBtn = document.getElementById('btn-convert');
      const cancelBtn = document.getElementById('btn-cancel-pipeline');
      try {
        convertBtn.disabled = true;
        cancelBtn.style.display = 'inline-flex';
        const finalMarkdown = await activePipeline.run(failedIndex);
        state.set({ markdownOutput: finalMarkdown });
        await renderPreview(finalMarkdown);
        await updateStatusBarStorage();
        showToast('Resumed conversion completed!', 'success');
      } catch (e) {
        showToast(`Resume error: ${e.message}`, 'error');
      } finally {
        convertBtn.disabled = false;
        cancelBtn.style.display = 'none';
      }
    });
  }
}

/* ==========================================================================
   10. Scanned Document OCR (Stage 5)
   ========================================================================== */
function initOcrUI() {
  const modal = document.getElementById('modal-ocr');
  const startBtn = document.getElementById('btn-ocr-start');
  const skipBtn = document.getElementById('btn-ocr-skip');
  const rangeInput = document.getElementById('ocr-page-range');
  const textarea = document.getElementById('text-input');

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      modal.classList.remove('active');
      if (pendingParsedResult) {
        textarea.value = pendingParsedResult.text;
        state.set({ inputText: textarea.value });
        openEstimatorDialog(textarea.value, pendingParsedResult.pageCount);
      }
    });
  }

  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      modal.classList.remove('active');

      const selectedMode = document.querySelector('input[name="ocr-mode"]:checked')?.value || 'local';
      const rangeVal = rangeInput.value.trim();

      const progressBox = document.getElementById('progress-container');
      const progressBar = document.getElementById('progress-bar-fill');
      const progressText = document.getElementById('progress-text');
      const progressPercent = document.getElementById('progress-percent');

      progressBox.classList.add('active');
      progressBar.style.width = '10%';
      progressText.textContent = 'Initializing OCR engine...';

      try {
        const langSelect = document.getElementById('select-language');
        const language = langSelect ? langSelect.value : 'English';

        let pages = [];
        if (pendingParsedResult?.scannedPages?.length > 0) {
          pages = pendingParsedResult.scannedPages;
        } else {
          pages = [1];
        }

        // Custom range filter (e.g. "1-3")
        if (rangeVal && rangeVal.toLowerCase() !== 'all') {
          const match = rangeVal.match(/(\d+)\s*-\s*(\d+)/);
          if (match) {
            const start = parseInt(match[1], 10);
            const end = parseInt(match[2], 10);
            pages = pages.filter(p => p >= start && p <= end);
          }
        }

        let runner = null;

        if (pendingParsedResult?.isImage) {
          runner = new OcrRunner({
            imageFile: pendingFileObject,
            mode: selectedMode,
            language: language,
            onProgress: (p) => {
              progressBar.style.width = `${p.percent}%`;
              progressText.textContent = p.status;
              progressPercent.textContent = `${p.percent}%`;
            }
          });
        } else {
          // Load PDF document for OCR page rendering
          if (!pendingPdfDoc && pendingFileBuffer) {
            const loadingTask = pdfjsLib.getDocument({
              data: new Uint8Array(pendingFileBuffer),
              useSystemFonts: true
            });
            pendingPdfDoc = await loadingTask.promise;
          }

          runner = new OcrRunner({
            pdfDocument: pendingPdfDoc,
            mode: selectedMode,
            language: language,
            pages: pages,
            onProgress: (p) => {
              progressBar.style.width = `${p.percent}%`;
              progressText.textContent = p.status;
              progressPercent.textContent = `${p.percent}%`;
            }
          });
        }

        const ocrResults = await runner.run();
        const extractedLines = Object.values(ocrResults).filter(Boolean).join('\n\n');

        let combinedText = pendingParsedResult?.text || '';
        if (combinedText.includes('[Scanned Page')) {
          // Replace scanned page placeholders with OCR text
          for (const pageNum in ocrResults) {
            const placeholder = `[Scanned Page ${pageNum} - Needs OCR]`;
            combinedText = combinedText.replace(placeholder, ocrResults[pageNum] || '');
          }
        } else {
          combinedText = (combinedText ? combinedText + '\n\n' : '') + extractedLines;
        }

        textarea.value = combinedText.trim();
        state.set({ inputText: textarea.value });

        await saveParsedFile({
          name: pendingFileObject ? pendingFileObject.name : 'OCR Document',
          size: pendingFileObject ? pendingFileObject.size : 0,
          type: 'text/ocr',
          text: textarea.value,
          pageCount: pages.length
        });

        await updateStatusBarStorage();
        showToast('OCR extraction completed successfully.', 'success');

        // Proceed to Estimator
        openEstimatorDialog(textarea.value, pages.length);
      } catch (err) {
        showToast(`OCR failed: ${err.message}`, 'error');
      } finally {
        progressBox.classList.remove('active');
      }
    });
  }
}

function promptOcrModal(file, result, arrayBuffer) {
  const modal = document.getElementById('modal-ocr');
  const descEl = document.getElementById('ocr-modal-desc');

  const count = result.scannedPages ? result.scannedPages.length : 1;
  descEl.textContent = `Found ${count} page${count === 1 ? '' : 's'} in "${file.name}" with no digital text layer. Choose an OCR method:`;

  modal.classList.add('active');
}

/* ==========================================================================
   11. Preview Rendering & Table of Contents (Stage 4)
   ========================================================================== */
async function renderPreview(markdown) {
  const container = document.getElementById('preview-container');
  const tocBox = document.getElementById('toc-container');
  const tocList = document.getElementById('toc-list');
  const rawViewer = document.getElementById('raw-markdown-viewer');
  const emptyState = document.getElementById('preview-empty-state');

  if (rawViewer) {
    rawViewer.textContent = markdown || '';
  }

  if (!markdown || !markdown.trim()) {
    if (emptyState) emptyState.style.display = 'flex';
    if (container) container.style.display = 'none';
    if (tocBox) tocBox.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (container) container.style.display = 'block';

  // Build Table of Contents
  const toc = extractToc(markdown);
  if (toc.length > 0 && tocBox && tocList) {
    tocBox.style.display = 'block';
    tocList.innerHTML = '';
    toc.forEach((h) => {
      const li = document.createElement('li');
      li.className = `toc-link toc-h${h.level}`;
      li.innerHTML = `<a href="#${h.id}" class="toc-link">${escapeHtml(h.text)}</a>`;
      tocList.appendChild(li);
    });
  } else if (tocBox) {
    tocBox.style.display = 'none';
  }

  const isDark = state.getTheme() === 'dark' || state.getTheme() === 'slate';
  await renderDocumentToElement(markdown, container, {
    isDark,
    onBlockFix: (blk) => {
      console.log('Fixed block:', blk.type);
    }
  });
}

/* ==========================================================================
   12. Export Downloads (Stage 5)
   ========================================================================== */
function initExportUI() {
  const downloadBtn = document.getElementById('btn-download');
  const menu = document.getElementById('download-menu');

  downloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });

  window.addEventListener('click', () => {
    menu.classList.remove('show');
  });

  document.getElementById('export-pdf').addEventListener('click', async () => {
    menu.classList.remove('show');
    const article = document.querySelector('.doc-article');
    if (!article) return showToast('No document content to export.', 'warning');
    showToast('Generating PDF (A4 with page numbers & diagrams)...', 'info');
    try {
      await exportToPdf(article, getDocumentTitle());
      showToast('PDF downloaded successfully.', 'success');
    } catch (err) {
      showToast(`PDF export failed: ${err.message}`, 'error');
    }
  });

  const exportPrintBtn = document.getElementById('export-print');
  if (exportPrintBtn) {
    exportPrintBtn.addEventListener('click', () => {
      menu.classList.remove('show');
      const article = document.querySelector('.doc-article');
      if (!article) return showToast('No document content to export.', 'warning');
      exportViaPrintIframe(article, getDocumentTitle());
      showToast('Opening print preview...', 'info');
    });
  }

  document.getElementById('export-html').addEventListener('click', async () => {
    menu.classList.remove('show');
    const article = document.querySelector('.doc-article');
    if (!article) return showToast('No document content to export.', 'warning');
    try {
      await exportToSelfContainedHtml(article, getDocumentTitle());
      showToast('HTML document downloaded.', 'success');
    } catch (err) {
      showToast(`HTML export failed: ${err.message}`, 'error');
    }
  });

  document.getElementById('export-docx').addEventListener('click', async () => {
    menu.classList.remove('show');
    const article = document.querySelector('.doc-article');
    if (!article) return showToast('No document content to export.', 'warning');
    showToast('Generating DOCX with styles, tables & images...', 'info');
    try {
      await exportToDocx(article, getDocumentTitle());
      showToast('DOCX downloaded successfully.', 'success');
    } catch (err) {
      showToast(`DOCX export failed: ${err.message}`, 'error');
    }
  });

  document.getElementById('export-md').addEventListener('click', () => {
    menu.classList.remove('show');
    const md = state.get().markdownOutput;
    if (!md) return showToast('No document content to export.', 'warning');
    exportToMarkdown(md, getDocumentTitle());
    showToast('Markdown downloaded.', 'success');
  });

  document.getElementById('export-zip').addEventListener('click', async () => {
    menu.classList.remove('show');
    const article = document.querySelector('.doc-article');
    const md = state.get().markdownOutput;
    if (!article || !md) return showToast('No document content to export.', 'warning');
    showToast('Packaging ZIP bundle...', 'info');
    try {
      await exportToZip(md, article, getDocumentTitle());
      showToast('ZIP bundle downloaded.', 'success');
    } catch (err) {
      showToast(`ZIP export failed: ${err.message}`, 'error');
    }
  });


  // Toggle Raw / Editable Markdown View (Stage E)
  const toggleViewBtn = document.getElementById('btn-toggle-view');
  const previewContainer = document.getElementById('preview-container');
  const rawViewer = document.getElementById('raw-markdown-viewer');

  let editDebounceTimer = null;
  if (rawViewer) {
    rawViewer.addEventListener('input', () => {
      clearTimeout(editDebounceTimer);
      editDebounceTimer = setTimeout(async () => {
        const updated = rawViewer.value;
        state.set({ markdownOutput: updated });
        await renderPreview(updated);
        updateAutosaveIndicator('Markdown edits saved locally');
      }, 250);
    });
  }

  if (toggleViewBtn && previewContainer && rawViewer) {
    toggleViewBtn.addEventListener('click', () => {
      const isRaw = rawViewer.style.display === 'block';
      if (isRaw) {
        rawViewer.style.display = 'none';
        previewContainer.style.display = 'block';
        toggleViewBtn.textContent = 'Edit Markdown';
      } else {
        rawViewer.value = state.get().markdownOutput || '';
        rawViewer.style.display = 'block';
        previewContainer.style.display = 'none';
        toggleViewBtn.textContent = 'View Formatted';
      }
    });
  }

  // Copy Dropdown (Stage E)
  const copyBtn = document.getElementById('btn-copy');
  const copyMenu = document.getElementById('copy-menu');
  if (copyBtn && copyMenu) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyMenu.classList.toggle('show');
    });

    window.addEventListener('click', () => {
      copyMenu.classList.remove('show');
    });

    document.getElementById('btn-copy-formatted')?.addEventListener('click', async () => {
      copyMenu.classList.remove('show');
      const article = document.querySelector('.doc-article');
      if (!article) return showToast('No document content to copy.', 'warning');
      try {
        const htmlBlob = new Blob([article.innerHTML], { type: 'text/html' });
        const textBlob = new Blob([article.innerText], { type: 'text/plain' });
        if (navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
          ]);
        } else {
          await navigator.clipboard.writeText(article.innerText);
        }
        showToast('Formatted text copied to clipboard.', 'success');
      } catch (e) {
        showToast(`Copy failed: ${e.message}`, 'error');
      }
    });

    document.getElementById('btn-copy-markdown')?.addEventListener('click', async () => {
      copyMenu.classList.remove('show');
      const md = state.get().markdownOutput;
      if (!md) return showToast('No document content to copy.', 'warning');
      try {
        await navigator.clipboard.writeText(md);
        showToast('Markdown copied to clipboard.', 'success');
      } catch (e) {
        showToast(`Copy failed: ${e.message}`, 'error');
      }
    });
  }

  // Print-Friendly Preview Toggle (Stage E)
  const printPreviewBtn = document.getElementById('btn-toggle-print-preview');
  if (printPreviewBtn) {
    printPreviewBtn.addEventListener('click', () => {
      const isPrint = document.body.classList.toggle('print-preview-mode');
      printPreviewBtn.textContent = isPrint ? '🖥️ Web View' : '📄 Print View';
      showToast(isPrint ? 'Print sheet preview enabled.' : 'Standard preview enabled.', 'info');
    });
  }
}

/* ==========================================================================
   14. Conversion History UI (Stage E)
   ========================================================================== */
function initHistoryUI() {
  const modal = document.getElementById('modal-history');
  const openBtn = document.getElementById('btn-open-history');
  const closeBtn = document.getElementById('btn-close-history');
  const doneBtn = document.getElementById('btn-done-history');
  const clearBtn = document.getElementById('btn-clear-history');
  const container = document.getElementById('history-list-container');
  const textarea = document.getElementById('text-input');

  if (!modal) return;

  const close = () => modal.classList.remove('active');
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (doneBtn) doneBtn.addEventListener('click', close);

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      renderHistoryList();
      modal.classList.add('active');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (window.confirm('Are you sure you want to delete all conversion history?')) {
        clearHistory();
        renderHistoryList();
        showToast('Conversion history cleared.', 'info');
      }
    });
  }

  function renderHistoryList() {
    if (!container) return;
    container.innerHTML = '';
    const list = getHistory();

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:32px 16px; color:var(--text-muted); font-size:0.88rem;">
          <div style="font-size:2rem; margin-bottom:8px;">🕒</div>
          No conversion history recorded yet.<br>Convert a document or load a sample to see it saved here.
        </div>
      `;
      return;
    }

    list.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'history-item-card';

      const dateStr = new Date(item.timestamp).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      card.innerHTML = `
        <div class="history-item-info">
          <strong>${escapeHtml(item.title)}</strong>
          <div class="history-item-meta">
            <span>📅 ${dateStr}</span>
            <span>📝 ${item.wordCount.toLocaleString()} words</span>
            <span class="badge-tag">${escapeHtml(item.docType || 'Document')}</span>
            <span class="badge-tag">${escapeHtml(item.language || 'English')}</span>
          </div>
        </div>
        <div class="history-item-actions">
          <button class="btn btn-sm btn-outline btn-restore-hist" type="button">Restore</button>
          <button class="btn btn-sm btn-outline btn-delete-hist" style="color:var(--danger); border-color:var(--danger-border);" type="button">Delete</button>
        </div>
      `;

      card.querySelector('.btn-restore-hist').addEventListener('click', async () => {
        if (textarea && item.rawText) {
          textarea.value = item.rawText;
        }
        state.set({
          inputText: item.rawText || '',
          markdownOutput: item.markdown || '',
          docType: item.docType || 'General',
          language: item.language || 'English'
        });
        await renderPreview(item.markdown || '');
        close();
        showToast(`Restored "${item.title}" from history.`, 'success');
      });

      card.querySelector('.btn-delete-hist').addEventListener('click', () => {
        deleteHistoryItem(item.id);
        renderHistoryList();
      });

      container.appendChild(card);
    });
  }
}


function getDocumentTitle() {
  const h1 = document.querySelector('.doc-article h1');
  return h1 ? h1.textContent.trim() : 'Formatted Document';
}

/* ==========================================================================
   13. Sample Loaders (Stage 6)
   ========================================================================== */
function initSamplesUI() {
  const sampleBtn = document.getElementById('btn-load-sample');
  const sampleMenu = document.getElementById('sample-menu');
  const textarea = document.getElementById('text-input');
  const wordCountEl = document.getElementById('word-count-badge');

  if (!sampleBtn || !sampleMenu) return;

  sampleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sampleMenu.classList.toggle('show');
  });

  window.addEventListener('click', () => {
    sampleMenu.classList.remove('show');
  });

  sampleMenu.querySelectorAll('[data-sample-id]').forEach((item) => {
    item.addEventListener('click', async () => {
      const sampleId = item.getAttribute('data-sample-id');
      const sample = SAMPLES[sampleId];
      if (sample) {
        textarea.value = sample.rawText;
        wordCountEl.textContent = `${countWords(sample.rawText).toLocaleString()} words`;
        state.set({
          inputText: sample.rawText,
          markdownOutput: sample.preformattedMarkdown
        });
        await renderPreview(sample.preformattedMarkdown);
        saveToHistory({
          title: sample.name,
          wordCount: countWords(sample.preformattedMarkdown),
          docType: 'Report',
          language: 'English',
          markdown: sample.preformattedMarkdown,
          rawText: sample.rawText
        });
        showToast(`Loaded sample: ${sample.name}`, 'success');
      }
    });
  });
}

/* ==========================================================================
   14. State Restoration & Toast Notifications
   ========================================================================== */
function restoreState() {
  const s = state.get();
  const textarea = document.getElementById('text-input');
  const wordCountEl = document.getElementById('word-count-badge');
  const docTypeSelect = document.getElementById('select-doctype');
  const langSelect = document.getElementById('select-language');
  const diagramSelect = document.getElementById('select-diagram-level');

  if (s.inputText && textarea) {
    textarea.value = s.inputText;
    wordCountEl.textContent = `${countWords(s.inputText).toLocaleString()} words`;
  }
  if (s.docType && docTypeSelect) docTypeSelect.value = s.docType;
  if (s.language && langSelect) langSelect.value = s.language;
  if (s.diagramLevel && diagramSelect) diagramSelect.value = s.diagramLevel;

  updateProviderSelectDropdown();
  updateStatusBarProvider();

  if (s.markdownOutput) {
    renderPreview(s.markdownOutput);
  } else {
    renderPreview('');
  }
}

function updateAutosaveIndicator(text) {
  const indicator = document.getElementById('autosave-text');
  if (indicator) {
    indicator.textContent = text;
  }
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 160);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
