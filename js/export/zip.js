/**
 * FormattingBuddy - ZIP Exporter
 * Bundles markdown, self-contained HTML, and any extracted diagrams into a ZIP archive.
 * Uses window.JSZip from vendor/jszip.min.js
 */
import { downloadBlob } from './html.js';

export async function exportToZip(markdownContent, articleEl, title = 'Formatted Document') {
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip library is not loaded');
  }

  const zip = new window.JSZip();
  const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'formatted-document';

  // 1. Add Markdown
  zip.file(`${slug}.md`, markdownContent);

  // 2. Clone and extract HTML & images
  const clone = articleEl.cloneNode(true);
  const imgFolder = zip.folder('images');

  const canvases = articleEl.querySelectorAll('canvas');
  const cloneCanvases = clone.querySelectorAll('canvas');

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const target = cloneCanvases[i];
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const filename = `chart-${i + 1}.png`;
      imgFolder.file(filename, base64, { base64: true });

      if (target) {
        const img = document.createElement('img');
        img.src = `images/${filename}`;
        target.parentNode.replaceChild(img, target);
      }
    } catch (err) {
      console.warn('Failed saving chart to ZIP:', err);
    }
  }

  // 3. Add clean HTML
  clone.querySelectorAll('.block-actions, button').forEach((el) => el.remove());
  const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111827; }
    h1 { font-size: 2rem; }
    h2 { font-size: 1.4rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 12px; }
    th { background: #f9fafb; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${clone.innerHTML}
</body>
</html>`;
  zip.file(`${slug}.html`, htmlDoc);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `${slug}.zip`);
}

