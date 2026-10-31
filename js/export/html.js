/**
 * FormattingBuddy - Self-contained HTML Exporter
 * Bundles typography, styles, inline SVGs and images so the document opens offline.
 */

export async function exportToSelfContainedHtml(articleEl, title = 'Formatted Document') {
  // Clone article to prepare for offline export
  const clone = articleEl.cloneNode(true);

  // Convert any Chart.js canvases to static images
  const originalCanvases = articleEl.querySelectorAll('canvas');
  const cloneCanvases = clone.querySelectorAll('canvas');

  for (let i = 0; i < originalCanvases.length; i++) {
    const orig = originalCanvases[i];
    const target = cloneCanvases[i];
    if (orig && target) {
      try {
        const dataUrl = orig.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.alt = 'Chart';
        target.parentNode.replaceChild(img, target);
      } catch (err) {
        console.warn('Failed inlining chart canvas to image:', err);
      }
    }
  }

  // Remove interactive edit/fix buttons from clone
  const actionBtns = clone.querySelectorAll('.block-actions, button');
  actionBtns.forEach((el) => el.remove());

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #ffffff;
      --surface: #f7f8fa;
      --surface-subtle: #f0f2f5;
      --border: #e2e4e9;
      --border-subtle: #eceef2;
      --text: #121316;
      --text-secondary: #525866;
      --accent: #5B5BD6;
      --radius: 10px;
      --font-system: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d0f12;
        --surface: #15181e;
        --surface-subtle: #222730;
        --border: #282e39;
        --border-subtle: #1e2229;
        --text: #f4f5f7;
        --text-secondary: #9aa1af;
      }
    }
    body {
      font-family: var(--font-system);
      line-height: 1.7;
      color: var(--text);
      background-color: var(--bg);
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 2rem; font-weight: 700; margin: 0 0 16px; letter-spacing: -0.02em; }
    h2 { font-size: 1.4rem; font-weight: 600; margin: 32px 0 12px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px; }
    h3 { font-size: 1.15rem; font-weight: 600; margin: 24px 0 8px; }
    p { margin: 0 0 16px; }
    ul, ol { margin: 0 0 16px 24px; }
    li { margin-bottom: 6px; }
    .table-wrapper { overflow-x: auto; margin: 20px 0; border: 1px solid var(--border); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { background: var(--surface); padding: 10px 14px; border-bottom: 1px solid var(--border); text-align: left; }
    td { padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); }
    tr:nth-child(even) td { background-color: var(--surface-subtle); }
    .section-summary { background-color: var(--surface-subtle); border-left: 3px solid var(--accent); padding: 12px 16px; margin: 0 0 16px; border-radius: 6px; }
    .block-card { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); margin: 24px 0; overflow: hidden; }
    .block-header { padding: 8px 14px; background: var(--surface-subtle); font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle); }
    .block-body { padding: 16px; display: flex; justify-content: center; }
    .mermaid-container svg { max-width: 100%; height: auto; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="container">
    ${clone.innerHTML}
  </div>
</body>
</html>`;

  downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), `${slugify(title)}.html`);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'formatted-document';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}
