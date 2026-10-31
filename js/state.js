/**
 * FormattingBuddy - App State & Autosave
 */

const STORAGE_KEY_DRAFT = 'formattingbuddy_draft_v1';
const STORAGE_KEY_THEME = 'formattingbuddy_theme_v1';

class StateManager {
  constructor() {
    this.state = {
      inputText: '',
      docType: 'report', // report, guide, briefing, manual, academic
      language: 'English',
      diagramLevel: 'balanced', // minimal, balanced, rich
      provider: 'auto', // 'auto' or provider ID
      activeModel: '',
      markdownOutput: '',
      isProcessing: false,
      currentChunkIndex: 0,
      totalChunks: 0,
      errorMessage: null,
      toc: []
    };
    this.listeners = new Set();
    this.loadDraft();
  }

  loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DRAFT);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state.inputText = parsed.inputText || '';
        this.state.docType = parsed.docType || 'report';
        this.state.language = parsed.language || 'English';
        this.state.diagramLevel = parsed.diagramLevel || 'balanced';
        this.state.provider = parsed.provider || 'auto';
        this.state.markdownOutput = parsed.markdownOutput || '';
      }
    } catch (e) {
      console.warn('Could not load draft from localStorage', e);
    }
  }

  saveDraft() {
    try {
      const toSave = {
        inputText: this.state.inputText,
        docType: this.state.docType,
        language: this.state.language,
        diagramLevel: this.state.diagramLevel,
        provider: this.state.provider,
        markdownOutput: this.state.markdownOutput,
        updatedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Could not save draft to localStorage', e);
    }
  }

  get() {
    return this.state;
  }

  set(updates) {
    Object.assign(this.state, updates);
    this.saveDraft();
    this.notify();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb(this.state);
    }
  }

  getTheme() {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    this.notify();
  }
}

export const state = new StateManager();
