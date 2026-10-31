/**
 * FormattingBuddy - Markdown Exporter
 */
import { downloadBlob } from './html.js';

export function exportToMarkdown(markdownContent, title = 'Formatted Document') {
  const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'formatted-document';
  const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${slug}.md`);
}

