/**
 * FormattingBuddy - Conversion History Manager (Stage E)
 * Persists recent document conversion runs with restore and clear capabilities.
 */

const STORAGE_KEY_HISTORY = 'formattingbuddy_history_v1';
const MAX_HISTORY_ITEMS = 25;

export function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed reading conversion history:', err);
    return [];
  }
}

export function saveToHistory(item) {
  try {
    const list = getHistory();
    const entry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title: item.title || 'Formatted Document',
      timestamp: Date.now(),
      wordCount: item.wordCount || 0,
      docType: item.docType || 'General',
      language: item.language || 'English',
      markdown: item.markdown || '',
      rawText: item.rawText || ''
    };

    // Prepend to top of list
    const updated = [entry, ...list.filter(h => h.markdown !== entry.markdown)].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
    return entry;
  } catch (err) {
    console.warn('Failed saving to conversion history:', err);
    return null;
  }
}

export function deleteHistoryItem(id) {
  try {
    const list = getHistory();
    const updated = list.filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.warn('Failed deleting history item:', err);
    return false;
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    return true;
  } catch (err) {
    console.warn('Failed clearing conversion history:', err);
    return false;
  }
}
