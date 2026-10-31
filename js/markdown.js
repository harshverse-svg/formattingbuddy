/**
 * FormattingBuddy - Markdown Processing & Block Dispatcher
 */
import { initMermaid, validateMermaid, renderMermaidDiagram, repairMermaidWithAI } from './blocks/mermaid.js';
import { renderChart } from './blocks/charts.js';
import { renderMap } from './blocks/maps.js';

export function extractToc(markdown) {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const toc = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim().replace(/\*\*/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      toc.push({ level, text, id: `heading-${id}-${i}` });
    }
  }
  return toc;
}

/**
 * Render complete Markdown string to interactive DOM inside previewElement
 */
export async function renderDocumentToElement(markdown, targetEl, options = {}) {
  const isDark = options.isDark || document.documentElement.classList.contains('dark');
  initMermaid(isDark ? 'dark' : 'light');

  if (!markdown || !markdown.trim()) {
    targetEl.innerHTML = `
      <div class="preview-empty">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <line x1="10" y1="9" x2="8" y2="9"></line>
        </svg>
        <p>No document generated yet. Paste text on the left and click Convert, or load a sample.</p>
      </div>
    `;
    return;
  }

  // Step 1: Pre-process custom fenced blocks (mermaid, chart, map) into placeholder tokens
  const blocks = [];
  let blockIndex = 0;

  const preprocessed = markdown.replace(/```(mermaid|chart|map)\s*([\s\S]*?)```/gi, (match, type, code) => {
    const token = `<!--FB_BLOCK_${blockIndex}-->`;
    blocks.push({
      index: blockIndex,
      type: type.toLowerCase(),
      code: code.trim(),
      token: token
    });
    blockIndex++;
    return token;
  });

  // Step 2: Parse standard Markdown with marked
  let html = '';
  if (typeof window.marked !== 'undefined') {
    // Configure marked
    window.marked.setOptions({
      gfm: true,
      breaks: true
    });
    html = window.marked.parse(preprocessed);
  } else {
    html = preprocessed.replace(/\n/g, '<br>');
  }

  // Step 3: Add IDs to H1/H2/H3 for smooth TOC navigation
  let headingCounter = 0;
  html = html.replace(/<h([1-3])>(.*?)<\/h\1>/gi, (match, level, content) => {
    const plainText = content.replace(/<[^>]+>/g, '').trim();
    const id = `heading-${plainText.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-${headingCounter++}`;
    return `<h${level} id="${id}">${content}</h${level}>`;
  });

  // Step 4: Wrap tables in responsive wrapper
  html = html.replace(/<table>/gi, '<div class="table-wrapper"><table>');
  html = html.replace(/<\/table>/gi, '</table></div>');

  // Step 5: Convert GitHub callouts like > [!SUMMARY] or > [!NOTE]
  html = html.replace(/<blockquote>\s*<p>\s*\[!(SUMMARY|NOTE|INFO|TIP|WARNING)\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi, (match, type, body) => {
    return `<div class="section-summary"><strong>${type.toUpperCase()}:</strong> ${body}</div>`;
  });

  // Step 6: Inject block card containers for each diagram/chart/map
  for (const blk of blocks) {
    const placeholderHtml = `
      <div class="block-card" id="block-card-${blk.index}" data-block-type="${blk.type}">
        <div class="block-header">
          <div class="block-title">
            <span>${getBlockIcon(blk.type)}</span>
            <span>${getBlockLabel(blk.type)}</span>
          </div>
          <div class="block-actions" id="block-actions-${blk.index}"></div>
        </div>
        <div class="block-body" id="block-body-${blk.index}">
          <div class="block-loading" style="font-size:0.85rem;color:var(--text-muted);padding:20px;">Rendering ${blk.type}...</div>
        </div>
      </div>
    `;
    html = html.replace(blk.token, placeholderHtml);
  }

  targetEl.innerHTML = `<article class="doc-article">${html}</article>`;

  // Step 7: Asynchronously render and validate each block
  for (const blk of blocks) {
    renderBlock(blk, isDark, options.onBlockFix);
  }
}

function getBlockIcon(type) {
  if (type === 'mermaid') return '📐';
  if (type === 'chart') return '📊';
  if (type === 'map') return '🗺️';
  return '📦';
}

function getBlockLabel(type) {
  if (type === 'mermaid') return 'Process Diagram';
  if (type === 'chart') return 'Data Chart';
  if (type === 'map') return 'Location Map';
  return 'Block';
}

async function renderBlock(blk, isDark, onBlockFix) {
  const bodyEl = document.getElementById(`block-body-${blk.index}`);
  const actionsEl = document.getElementById(`block-actions-${blk.index}`);
  if (!bodyEl) return;

  if (blk.type === 'mermaid') {
    const validation = await validateMermaid(blk.code);
    if (!validation.valid) {
      // Show clear error placeholder with "Fix this block" button
      showBlockError(
        blk,
        bodyEl,
        actionsEl,
        validation.error,
        async () => {
          actionsEl.innerHTML = `<span style="font-size:0.75rem;color:var(--text-muted);">Fixing with AI...</span>`;
          try {
            const fixedCode = await repairMermaidWithAI(blk.code, validation.error);
            blk.code = fixedCode;
            if (onBlockFix) onBlockFix(blk);
            await renderBlock(blk, isDark, onBlockFix);
          } catch (err) {
            showBlockError(blk, bodyEl, actionsEl, `Fix failed: ${err.message}`);
          }
        }
      );
      return;
    }

    try {
      bodyEl.innerHTML = `<div class="mermaid-container" id="mermaid-wrap-${blk.index}"></div>`;
      const wrap = document.getElementById(`mermaid-wrap-${blk.index}`);
      await renderMermaidDiagram(blk.index, blk.code, wrap);
      if (actionsEl) actionsEl.innerHTML = '';
    } catch (err) {
      showBlockError(blk, bodyEl, actionsEl, err.message);
    }
  } else if (blk.type === 'chart') {
    try {
      bodyEl.innerHTML = `<div class="chart-container"><canvas id="chart-canvas-${blk.index}"></canvas></div>`;
      const canvas = document.getElementById(`chart-canvas-${blk.index}`);
      renderChart(canvas, blk.code, isDark);
      if (actionsEl) actionsEl.innerHTML = '';
    } catch (err) {
      showBlockError(blk, bodyEl, actionsEl, err.message);
    }
  } else if (blk.type === 'map') {
    try {
      bodyEl.innerHTML = `<div class="map-container" id="map-wrap-${blk.index}"></div>`;
      const mapWrap = document.getElementById(`map-wrap-${blk.index}`);
      const { warnings } = await renderMap(mapWrap, blk.code, isDark);
      if (warnings && warnings.length > 0 && actionsEl) {
        actionsEl.innerHTML = `<span class="badge" style="font-size:0.72rem;background:var(--warning-subtle);color:var(--warning);padding:2px 6px;border-radius:4px;">${warnings.length} place(s) unmapped</span>`;
      } else if (actionsEl) {
        actionsEl.innerHTML = '';
      }
    } catch (err) {
      showBlockError(blk, bodyEl, actionsEl, err.message);
    }
  }
}

function showBlockError(blk, bodyEl, actionsEl, errorText, fixCallback) {
  bodyEl.innerHTML = `
    <div class="block-error-container">
      <div class="block-error-title">Unable to render ${blk.type} block</div>
      <div class="block-error-code">${escapeHtml(errorText)}</div>
    </div>
  `;

  if (actionsEl && fixCallback) {
    actionsEl.innerHTML = `<button class="btn btn-sm btn-outline" id="fix-btn-${blk.index}">Fix this block</button>`;
    const btn = document.getElementById(`fix-btn-${blk.index}`);
    if (btn) {
      btn.addEventListener('click', fixCallback);
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
