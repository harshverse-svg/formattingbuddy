/**
 * FormattingBuddy - AI Provider Registry & Inference Engine
 * Supports 8 providers + Auto fallback.
 * Encrypts API keys with AES-GCM using Web Crypto.
 */
import { encryptData, decryptData } from './crypto.js';

const STORAGE_KEY_ENCRYPTED_KEYS = 'formattingbuddy_keys_v1';
const STORAGE_KEY_PROVIDER_SETTINGS = 'formattingbuddy_provider_settings_v1';

export const PROVIDER_DEFS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    getKeyUrl: 'https://aistudio.google.com/apikey',
    badge: 'Recommended',
    needsBaseUrl: false
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    getKeyUrl: 'https://console.groq.com/keys',
    badge: 'Ultra Fast',
    needsBaseUrl: false
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultModel: 'google/gemini-2.5-flash',
    getKeyUrl: 'https://openrouter.ai/keys',
    badge: 'Multi-Model',
    needsBaseUrl: false
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    defaultModel: 'mistral-small-latest',
    getKeyUrl: 'https://console.mistral.ai/api-keys',
    badge: 'Standard',
    needsBaseUrl: false
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama Cloud',
    defaultModel: 'llama3.2',
    getKeyUrl: 'https://ollama.com/settings/keys',
    badge: 'Local/Cloud',
    needsBaseUrl: true,
    defaultBaseUrl: 'https://api.ollama.com/v1'
  },
  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face',
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
    getKeyUrl: 'https://huggingface.co/settings/tokens',
    badge: 'Open Source',
    needsBaseUrl: false
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-20241022',
    getKeyUrl: 'https://platform.claude.com/settings/keys',
    badge: 'Advanced',
    needsBaseUrl: false
  },
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    defaultModel: 'gpt-4o-mini',
    getKeyUrl: '',
    badge: 'Custom',
    needsBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434/v1'
  }
};

class ProviderManager {
  constructor() {
    this.decryptedKeys = {}; // In-memory only: providerId -> apiKey
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROVIDER_SETTINGS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load provider settings', e);
    }

    // Default settings
    const defaults = {};
    for (const id in PROVIDER_DEFS) {
      const def = PROVIDER_DEFS[id];
      defaults[id] = {
        enabled: id === 'gemini',
        model: def.defaultModel,
        baseUrl: def.defaultBaseUrl || ''
      };
    }
    return defaults;
  }

  saveSettings() {
    localStorage.setItem(STORAGE_KEY_PROVIDER_SETTINGS, JSON.stringify(this.settings));
  }

  getSettings(providerId) {
    if (!this.settings[providerId]) {
      const def = PROVIDER_DEFS[providerId] || {};
      this.settings[providerId] = {
        enabled: false,
        model: def.defaultModel || '',
        baseUrl: def.defaultBaseUrl || ''
      };
    }
    return this.settings[providerId];
  }

  updateSettings(providerId, updates) {
    this.settings[providerId] = Object.assign(this.getSettings(providerId), updates);
    this.saveSettings();
  }

  async loadDecryptedKeys(cryptoKey) {
    if (!cryptoKey) {
      this.decryptedKeys = {};
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ENCRYPTED_KEYS);
      if (!raw) {
        this.decryptedKeys = {};
        return;
      }
      const encryptedObj = JSON.parse(raw);
      const decrypted = {};
      for (const id in encryptedObj) {
        try {
          decrypted[id] = await decryptData(encryptedObj[id], cryptoKey);
        } catch (err) {
          console.warn(`Failed decrypting key for provider ${id}:`, err);
        }
      }
      this.decryptedKeys = decrypted;
    } catch (err) {
      console.warn('Failed loading encrypted keys:', err);
      this.decryptedKeys = {};
    }
  }

  async setKey(providerId, keyPlaintext, cryptoKey) {
    if (!cryptoKey) {
      throw new Error('Application is locked. Unlock to update keys.');
    }
    this.decryptedKeys[providerId] = keyPlaintext ? keyPlaintext.trim() : '';

    // Encrypt and persist
    let existingEncrypted = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ENCRYPTED_KEYS);
      if (raw) existingEncrypted = JSON.parse(raw);
    } catch {
      existingEncrypted = {};
    }

    if (!this.decryptedKeys[providerId]) {
      delete existingEncrypted[providerId];
    } else {
      existingEncrypted[providerId] = await encryptData(this.decryptedKeys[providerId], cryptoKey);
    }

    localStorage.setItem(STORAGE_KEY_ENCRYPTED_KEYS, JSON.stringify(existingEncrypted));
  }

  getKey(providerId) {
    return this.decryptedKeys[providerId] || '';
  }

  hasKey(providerId) {
    return !!(this.decryptedKeys[providerId] && this.decryptedKeys[providerId].trim().length > 0);
  }

  getEnabledProviders() {
    return Object.keys(PROVIDER_DEFS).filter((id) => {
      const s = this.getSettings(id);
      return s.enabled && this.hasKey(id);
    });
  }

  /**
   * Test an API key against a provider.
   * Returns: { success: boolean, message: string, status?: number }
   */
  async testKey(providerId, customKey = null) {
    const key = customKey !== null ? customKey : this.getKey(providerId);
    if (!key && providerId !== 'custom') {
      return { success: false, message: 'Please enter an API key first.' };
    }

    const s = this.getSettings(providerId);
    const model = s.model || PROVIDER_DEFS[providerId].defaultModel;

    try {
      if (providerId === 'gemini') {
        // Use x-goog-api-key header to avoid key in URL
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Respond with OK.' }] }]
          })
        });
        if (!res.ok) return this.parseErrorResponse(res);
        return { success: true, message: `Connected to Gemini (${model}) successfully.` };
      }

      if (providerId === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5
          })
        });
        if (!res.ok) return this.parseErrorResponse(res);
        return { success: true, message: `Connected to Groq (${model}) successfully.` };
      }

      if (providerId === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'FormattingBuddy'
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5
          })
        });
        if (!res.ok) return this.parseErrorResponse(res);
        return { success: true, message: `Connected to OpenRouter (${model}) successfully.` };
      }

      if (providerId === 'mistral') {
        const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5
          })
        });
        if (!res.ok) return this.parseErrorResponse(res);
        return { success: true, message: `Connected to Mistral (${model}) successfully.` };
      }

      if (providerId === 'ollama') {
        const base = (s.baseUrl || PROVIDER_DEFS.ollama.defaultBaseUrl).replace(/\/+$/, '');
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = `Bearer ${key}`;
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Ping' }]
          })
        });
        if (!res.ok) return this.parseErrorResponse(res);
        return { success: true, message: `Connected to Ollama (${model}) successfully.` };
      }

      if (providerId === 'huggingface') {
        const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5
          })
        });
        if (!res.ok) return this.parseErrorResponse(res);
        return { success: true, message: `Connected to Hugging Face (${model}) successfully.` };
      }

      if (providerId === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5
          })
        });
        if (!res.ok) return this.parseErrorResponse(res);
        return { success: true, message: `Connected to Anthropic (${model}) successfully.` };
      }

      if (providerId === 'custom') {
        const base = (s.baseUrl || PROVIDER_DEFS.custom.defaultBaseUrl).replace(/\/+$/, '');
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = `Bearer ${key}`;
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5
          })
        });
        if (!res.ok) return this.parseErrorResponse(res);
        return { success: true, message: `Connected to Custom Endpoint (${model}) successfully.` };
      }
    } catch (err) {
      return {
        success: false,
        message: `Network/CORS error: Direct browser call was blocked or unreachable. (${err.message})`
      };
    }

    return { success: false, message: 'Unknown provider.' };
  }

  async parseErrorResponse(res) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data.error?.message || data.message || JSON.stringify(data);
    } catch {
      detail = res.statusText;
    }

    if (res.status === 401 || res.status === 403) {
      return { success: false, status: res.status, message: `Invalid API key or unauthorized (HTTP ${res.status}): ${detail}` };
    }
    if (res.status === 429) {
      return { success: false, status: 429, message: `Rate limit or quota exceeded (HTTP 429): ${detail}` };
    }
    if (res.status >= 500) {
      return { success: false, status: res.status, message: `Provider service error (HTTP ${res.status}): ${detail}` };
    }
    return { success: false, status: res.status, message: `Error ${res.status}: ${detail}` };
  }

  /**
   * Execute chat completion call for a single chunk of text.
   */
  async generateCompletion(providerId, systemPrompt, userPrompt, abortSignal = null) {
    const key = this.getKey(providerId);
    if (!key && providerId !== 'custom') {
      throw new Error(`API key for ${PROVIDER_DEFS[providerId]?.name || providerId} is missing.`);
    }

    const s = this.getSettings(providerId);
    const model = s.model || PROVIDER_DEFS[providerId].defaultModel;

    if (providerId === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: abortSignal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2
          }
        })
      });
      if (!res.ok) {
        const err = await this.parseErrorResponse(res);
        const errorObj = new Error(err.message);
        errorObj.status = err.status;
        throw errorObj;
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    if (providerId === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: abortSignal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 4096,
          temperature: 0.2
        })
      });
      if (!res.ok) {
        const err = await this.parseErrorResponse(res);
        const errorObj = new Error(err.message);
        errorObj.status = err.status;
        throw errorObj;
      }
      const data = await res.json();
      return data.content?.[0]?.text || '';
    }

    // Standard OpenAI compatible providers: groq, openrouter, mistral, ollama, huggingface, custom
    let endpoint = '';
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    if (providerId === 'groq') {
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    } else if (providerId === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'FormattingBuddy';
    } else if (providerId === 'mistral') {
      endpoint = 'https://api.mistral.ai/v1/chat/completions';
    } else if (providerId === 'ollama') {
      const base = (s.baseUrl || PROVIDER_DEFS.ollama.defaultBaseUrl).replace(/\/+$/, '');
      endpoint = `${base}/chat/completions`;
    } else if (providerId === 'huggingface') {
      endpoint = `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`;
    } else if (providerId === 'custom') {
      const base = (s.baseUrl || PROVIDER_DEFS.custom.defaultBaseUrl).replace(/\/+$/, '');
      endpoint = `${base}/chat/completions`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      signal: abortSignal,
      headers,
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const err = await this.parseErrorResponse(res);
      const errorObj = new Error(err.message);
      errorObj.status = err.status;
      throw errorObj;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

export const providers = new ProviderManager();
