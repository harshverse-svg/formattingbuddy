/**
 * FormattingBuddy - Main Application Controller
 */
import { auth } from './auth.js';
import { state } from './state.js';
import { providers, PROVIDER_DEFS } from './providers.js';
import { ConversionPipeline, countWords } from './chunker.js';
import { renderDocumentToElement, extractToc } from './markdown.js';
import { exportToSelfContainedHtml } from './export/html.js';
import { exportToMarkdown } from './export/markdown.js';
import { exportToPdf } from './export/pdf.js';
import { exportToDocx } from './export/docx.js';
import { exportToZip } from './export/zip.js';
import { SAMPLES } from './samples.js';

let activePipeline = null;
let deferredInstallPrompt = null;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initPwa();
  initTheme();
  initAuthUI();
  initSettingsUI();
  initEditorUI();
  initExportUI();
  initSamplesUI();
  restoreState();
});

/* ==========================================================================
   1. PWA & Service Worker
   ========================================================================== */
function initPwa() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('FormattingBuddy SW registered:', reg.scope);
      }).catch((err) => {
        console.warn('FormattingBuddy SW registration failed:', err);
      });
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
   2. Theme Toggle
   ========================================================================== */
function initTheme() {
  const currentTheme = state.getTheme();
  state.setTheme(currentTheme);

  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  if (themeToggleBtn) {
    updateThemeIcon(themeToggleBtn, currentTheme);
    themeToggleBtn.addEventListener('click', () => {
      const active = state.getTheme();
      const next = active === 'dark' ? 'light' : 'dark';
      state.setTheme(next);
      updateThemeIcon(themeToggleBtn, next);
      // Re-render current document to update diagram & chart colors
      const currentMd = state.get().markdownOutput;
      if (currentMd) {
        renderPreview(currentMd);
      }
    });
  }
}

function updateThemeIcon(btn, theme) {
  btn.innerHTML = theme === 'dark'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
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
      } else {
        const derivedKey = await auth.unlock(val);
        await providers.loadDecryptedKeys(derivedKey);
        hideAuthModal();
        showToast('Workspace unlocked.', 'success');
      }
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
    resetBtn.addEventListener('click', () => {
      const confirmed = window.confirm(
        'Warning: "Reset App" will completely wipe your local passcode, all stored API keys, and your autosaved drafts from this device. Are you sure?'
      );
      if (confirmed) {
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

  auth.onChange((status) => {
    if (!status.isAuthenticated) {
      showAuthModal(!status.isSetup);
    }
  });
}

/* ==========================================================================
   4. Settings & API Key Manager (Stage 2)
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

          <div class="input-row" style="justify-content: space-between; align-items: center;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:0.75rem; color:var(--text-muted);">Model:</span>
              <input type="text" class="text-input" style="height:28px; width:190px; font-size:0.8rem;" id="model-${id}" value="${escapeHtml(s.model || def.defaultModel)}">
            </div>
            ${def.getKeyUrl ? `
              <a href="${def.getKeyUrl}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem; color:var(--accent); text-decoration:none;">Get a key &rarr;</a>
            ` : ''}
          </div>
          <div id="test-status-${id}" style="font-size:0.78rem; display:none;"></div>
        </div>
      `;

      container.appendChild(card);

      // Event handlers for this card
      const enableCb = card.querySelector(`#enable-${id}`);
      const keyInput = card.querySelector(`#key-${id}`);
      const toggleKeyBtn = card.querySelector(`#toggle-key-${id}`);
      const modelInput = card.querySelector(`#model-${id}`);
      const testBtn = card.querySelector(`#test-${id}`);
      const statusEl = card.querySelector(`#test-status-${id}`);
      const baseUrlInput = card.querySelector(`#baseurl-${id}`);

      enableCb.addEventListener('change', () => {
        providers.updateSettings(id, { enabled: enableCb.checked });
      });

      modelInput.addEventListener('change', () => {
        providers.updateSettings(id, { model: modelInput.value.trim() });
      });

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
          // Temporarily save inputs before testing
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
   5. Editor UI, Chunking Pipeline & Autosave (Stage 3)
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

  // Update word count & autosave draft
  function updateWords() {
    const text = textarea.value;
    const words = countWords(text);
    wordCountEl.textContent = `${words.toLocaleString()} words`;
    state.set({ inputText: text });
    updateAutosaveIndicator('Saved locally');
  }

  textarea.addEventListener('input', updateWords);

  // Options changes
  docTypeSelect.addEventListener('change', () => state.set({ docType: docTypeSelect.value }));
  langSelect.addEventListener('change', () => state.set({ language: langSelect.value }));
  diagramSelect.addEventListener('change', () => state.set({ diagramLevel: diagramSelect.value }));
  providerSelect.addEventListener('change', () => state.set({ provider: providerSelect.value }));

  // File drag & drop (2MB max limit)
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
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
      handleFile(e.dataTransfer.files[0]);
    }
  });

  function handleFile(file) {
    if (file.size > MAX_FILE_SIZE) {
      showToast('File size exceeds the 2 MB limit.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      textarea.value = event.target.result;
      updateWords();
      showToast(`Loaded ${file.name} (${countWords(textarea.value)} words).`, 'success');
    };
    reader.onerror = () => {
      showToast('Failed to read file.', 'error');
    };
    reader.readAsText(file);
  }

  // Convert Pipeline Execution
  convertBtn.addEventListener('click', async () => {
    if (!auth.isAuthenticated) {
      showToast('Please unlock the workspace first.', 'warning');
      return;
    }

    const text = textarea.value.trim();
    if (!text) {
      showToast('Please paste or upload some plain text first.', 'warning');
      return;
    }

    // Switch to preview tab on mobile
    if (tabPreviewBtn && window.innerWidth <= 900) {
      tabPreviewBtn.click();
    }

    activePipeline = new ConversionPipeline({
      text: text,
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
      await renderPreview(finalMarkdown);
      showToast('Document conversion completed!', 'success');
    } catch (err) {
      if (err.message.includes('cancelled')) {
        showToast('Conversion cancelled.', 'info');
      } else {
        showToast(`Conversion error: ${err.message}`, 'error');
        // If there was a partial failure, offer resume button
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
  });

  cancelBtn.addEventListener('click', () => {
    if (activePipeline) {
      activePipeline.cancel();
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Cancelling...';
    }
  });

  function showResumeOption(failedIndex) {
    progressText.innerHTML = `Failed at section ${failedIndex + 1}. <button id="btn-resume" class="btn btn-sm btn-outline" style="margin-left:8px;">Resume</button>`;
    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', async () => {
        try {
          convertBtn.disabled = true;
          cancelBtn.style.display = 'inline-flex';
          const finalMarkdown = await activePipeline.run(failedIndex);
          state.set({ markdownOutput: finalMarkdown });
          await renderPreview(finalMarkdown);
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
}

/* ==========================================================================
   6. Preview Rendering & Table of Contents (Stage 4)
   ========================================================================== */
async function renderPreview(markdown) {
  const container = document.getElementById('preview-container');
  const tocBox = document.getElementById('toc-container');
  const tocList = document.getElementById('toc-list');
  const rawViewer = document.getElementById('raw-markdown-viewer');

  if (rawViewer) {
    rawViewer.textContent = markdown || '';
  }

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

  const isDark = state.getTheme() === 'dark';
  await renderDocumentToElement(markdown, container, {
    isDark,
    onBlockFix: (blk) => {
      console.log('Fixed block:', blk.type);
    }
  });
}

/* ==========================================================================
   7. Export Downloads (Stage 5)
   ========================================================================== */
function initExportUI() {
  const downloadBtn = document.getElementById('btn-download');
  const menu = document.getElementById('download-menu');

  // Toggle download menu
  downloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });

  window.addEventListener('click', () => {
    menu.classList.remove('show');
  });

  // Export actions
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

  // Toggle Raw / Preview View
  const toggleViewBtn = document.getElementById('btn-toggle-view');
  const previewContainer = document.getElementById('preview-container');
  const rawViewer = document.getElementById('raw-markdown-viewer');

  if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', () => {
      const isRaw = rawViewer.style.display === 'block';
      if (isRaw) {
        rawViewer.style.display = 'none';
        previewContainer.style.display = 'block';
        toggleViewBtn.textContent = 'View Markdown';
      } else {
        rawViewer.style.display = 'block';
        previewContainer.style.display = 'none';
        toggleViewBtn.textContent = 'View Formatted';
      }
    });
  }
}

function getDocumentTitle() {
  const h1 = document.querySelector('.doc-article h1');
  return h1 ? h1.textContent.trim() : 'Formatted Document';
}

/* ==========================================================================
   8. Sample Loaders (Stage 6)
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
        showToast(`Loaded sample: ${sample.name}`, 'success');
      }
    });
  });
}

/* ==========================================================================
   9. State Restoration & Toast Notifications
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

  if (s.markdownOutput) {
    renderPreview(s.markdownOutput);
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
