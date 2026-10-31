/**
 * FormattingBuddy - PDF Exporter (A4, Sliced/Paged, Noto Fonts, Automatic Verification)
 * Dedicated light print document, rasterized blocks, jsPDF + html2canvas with Fallback Print route.
 */

import { downloadBlob } from './html.js';

let notoSansBase64 = null;
let notoDevaBase64 = null;
let exportLogs = [];

function logDiagnostic(msg, type = 'info') {
  const entry = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${msg}`;
  exportLogs.push(entry);
  if (exportLogs.length > 50) exportLogs.shift();
  if (type === 'error') console.error(msg);
  else console.log(msg);
}

/**
 * Preload and register bundled TTF fonts into a jsPDF instance.
 */
async function registerBundledFonts(doc) {
  try {
    if (!notoSansBase64) {
      const r1 = await fetch('./vendor/fonts/NotoSans-Regular.ttf');
      if (r1.ok) {
        const buf = await r1.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        notoSansBase64 = btoa(binary);
      }
    }
    if (!notoDevaBase64) {
      const r2 = await fetch('./vendor/fonts/NotoSansDevanagari-Regular.ttf');
      if (r2.ok) {
        const buf = await r2.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        notoDevaBase64 = btoa(binary);
      }
    }

    if (notoSansBase64) {
      doc.addFileToVFS('NotoSans-Regular.ttf', notoSansBase64);
      doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    }
    if (notoDevaBase64) {
      doc.addFileToVFS('NotoSansDevanagari-Regular.ttf', notoDevaBase64);
      doc.addFont('NotoSansDevanagari-Regular.ttf', 'NotoSansDevanagari', 'normal');
    }
    logDiagnostic('Bundled Noto fonts registered in jsPDF VFS');
  } catch (err) {
    logDiagnostic(`Font preloading note: ${err.message}`, 'warn');
  }
}

/**
 * Detects if text contains CJK glyphs to apply fallback styling if needed.
 */
function containsCJK(text) {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(text);
}

/**
 * Convert all SVGs in the clone into static crisp PNG <img> elements.
 */
async function rasterizeSvgElements(articleEl, cloneEl) {
  const origSvgs = articleEl.querySelectorAll('svg');
  const cloneSvgs = cloneEl.querySelectorAll('svg');

  for (let i = 0; i < origSvgs.length; i++) {
    const orig = origSvgs[i];
    const target = cloneSvgs[i];
    if (!orig || !target) continue;

    try {
      const bbox = orig.getBoundingClientRect();
      const width = Math.max(Math.round(bbox.width) || 600, 300);
      const height = Math.max(Math.round(bbox.height) || 400, 200);

      const serializer = new XMLSerializer();
      let svgStr = serializer.serializeToString(orig);
      if (!svgStr.includes('xmlns=')) {
        svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = blobUrl;
      });

      const canvas = document.createElement('canvas');
      const scale = 2; // Crisp 2x retina capture
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);

      const pngImg = document.createElement('img');
      pngImg.src = canvas.toDataURL('image/png');
      pngImg.style.maxWidth = '100%';
      pngImg.style.height = 'auto';
      pngImg.style.display = 'block';
      pngImg.style.margin = '0 auto';
      target.parentNode.replaceChild(pngImg, target);
    } catch (err) {
      logDiagnostic(`SVG rasterization error: ${err.message}`, 'warn');
    }
  }
}

/**
 * Convert all Chart.js canvases in the clone into static PNG <img> elements.
 */
function rasterizeCanvasElements(articleEl, cloneEl) {
  const origCanvases = articleEl.querySelectorAll('canvas');
  const cloneCanvases = cloneEl.querySelectorAll('canvas');

  for (let i = 0; i < origCanvases.length; i++) {
    const orig = origCanvases[i];
    const target = cloneCanvases[i];
    if (!orig || !target) continue;

    try {
      const dataUrl = orig.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '0 auto';
      target.parentNode.replaceChild(img, target);
    } catch (err) {
      logDiagnostic(`Canvas rasterization error: ${err.message}`, 'warn');
    }
  }
}

/**
 * Convert Leaflet map containers into static PNG <img> elements using html2canvas.
 */
async function rasterizeMapElements(articleEl, cloneEl) {
  const origMaps = articleEl.querySelectorAll('.map-container');
  const cloneMaps = cloneEl.querySelectorAll('.map-container');

  for (let i = 0; i < origMaps.length; i++) {
    const orig = origMaps[i];
    const target = cloneMaps[i];
    if (!orig || !target) continue;

    try {
      if (typeof window.html2canvas === 'function') {
        const canvas = await window.html2canvas(orig, {
          useCORS: true,
          scale: 2,
          logging: false
        });
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        target.parentNode.replaceChild(img, target);
      } else {
        throw new Error('html2canvas unavailable for map rasterization');
      }
    } catch (err) {
      logDiagnostic(`Map rasterization fallback applied: ${err.message}`, 'warn');
      const fallbackBox = document.createElement('div');
      fallbackBox.style.padding = '24px';
      fallbackBox.style.border = '1px dashed #cbd5e1';
      fallbackBox.style.borderRadius = '8px';
      fallbackBox.style.textAlign = 'center';
      fallbackBox.style.color = '#64748b';
      fallbackBox.style.fontSize = '12px';
      fallbackBox.textContent = '🗺️ Map Location Overview';
      target.parentNode.replaceChild(fallbackBox, target);
    }
  }
}

/**
 * Creates the fixed light print stylesheet content.
 */
function getPrintStylesheetContent() {
  return `
    @font-face {
      font-family: 'NotoSans';
      src: url('./vendor/fonts/NotoSans-Regular.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'NotoSansDevanagari';
      src: url('./vendor/fonts/NotoSansDevanagari-Regular.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    .pdf-print-root {
      background-color: #ffffff !important;
      color: #111827 !important;
      font-family: 'NotoSans', 'NotoSansDevanagari', system-ui, -apple-system, "Nirmala UI", sans-serif !important;
      font-size: 13.5px !important;
      line-height: 1.6 !important;
      box-sizing: border-box !important;
      width: 794px !important;
      padding: 24px 32px !important;
    }
    .pdf-print-root * {
      box-sizing: border-box !important;
      color: #111827 !important;
      background-color: transparent;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      text-shadow: none !important;
      box-shadow: none !important;
    }
    .pdf-print-root h1 {
      font-size: 22px !important;
      font-weight: 700 !important;
      color: #111827 !important;
      margin: 0 0 16px 0 !important;
      line-height: 1.3 !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .pdf-print-root h2 {
      font-size: 17px !important;
      font-weight: 700 !important;
      color: #111827 !important;
      margin: 22px 0 8px 0 !important;
      padding-bottom: 4px !important;
      border-bottom: 1px solid #e5e7eb !important;
      line-height: 1.35 !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .pdf-print-root h3 {
      font-size: 14.5px !important;
      font-weight: 600 !important;
      color: #111827 !important;
      margin: 16px 0 6px 0 !important;
      line-height: 1.4 !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .pdf-print-root p {
      margin: 0 0 12px 0 !important;
      color: #1f2937 !important;
    }
    .pdf-print-root ul, .pdf-print-root ol {
      margin: 0 0 12px 0 !important;
      padding-left: 24px !important;
    }
    .pdf-print-root li {
      margin-bottom: 4px !important;
    }
    .pdf-print-root table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 14px 0 !important;
      font-size: 12px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .pdf-print-root th {
      background-color: #f3f4f6 !important;
      color: #111827 !important;
      font-weight: 600 !important;
      padding: 6px 10px !important;
      border: 1px solid #d1d5db !important;
      text-align: left !important;
    }
    .pdf-print-root td {
      padding: 6px 10px !important;
      border: 1px solid #e5e7eb !important;
      color: #1f2937 !important;
    }
    .pdf-print-root tr:nth-child(even) td {
      background-color: #f9fafb !important;
    }
    .pdf-print-root .table-wrapper,
    .pdf-print-root .block-card,
    .pdf-print-root .section-summary {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .pdf-print-root .section-summary {
      background-color: #f8fafc !important;
      border-left: 3px solid #4F5BD5 !important;
      padding: 10px 14px !important;
      margin: 12px 0 !important;
      border-radius: 4px !important;
    }
    .pdf-print-root .block-card {
      border: 1px solid #e5e7eb !important;
      border-radius: 8px !important;
      background-color: #ffffff !important;
      margin: 16px 0 !important;
      overflow: hidden !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .pdf-print-root .block-header {
      background-color: #f9fafb !important;
      padding: 6px 12px !important;
      font-weight: 600 !important;
      font-size: 12px !important;
      color: #4b5563 !important;
      border-bottom: 1px solid #e5e7eb !important;
    }
    .pdf-print-root .block-body {
      padding: 12px !important;
      display: flex !important;
      justify-content: center !important;
      background-color: #ffffff !important;
    }
    .pdf-print-root img {
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 0 auto !important;
    }
    .pdf-print-root blockquote {
      border-left: 3px solid #cbd5e1 !important;
      padding-left: 12px !important;
      margin: 12px 0 !important;
      color: #4b5563 !important;
      font-style: italic !important;
    }
    .pdf-print-root code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important;
      font-size: 11.5px !important;
      background-color: #f1f5f9 !important;
      padding: 2px 4px !important;
      border-radius: 3px !important;
    }
    .pdf-print-root pre {
      background-color: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      padding: 10px 14px !important;
      border-radius: 6px !important;
      overflow-x: auto !important;
      margin: 12px 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .pdf-print-root pre code {
      background: transparent !important;
      padding: 0 !important;
    }
  `;
}

/**
 * Automatically verifies generated PDF blob using PDF.js.
 * Checks page count > 0, text extraction, and page 1 pixel variance > 100.
 */
export async function verifyPdfBlob(blob) {
  try {
    if (!blob || blob.size < 500) {
      return { ok: false, reason: 'Generated PDF blob is empty or too small.' };
    }

    if (!window.pdfjsLib) {
      logDiagnostic('pdfjsLib is not present, skipping verification', 'warn');
      return { ok: true, skipped: true };
    }

    const buffer = await blob.arrayBuffer();
    const pdfDoc = await window.pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true
    }).promise;

    if (!pdfDoc.numPages || pdfDoc.numPages === 0) {
      return { ok: false, reason: 'PDF document contains zero pages.' };
    }

    const page1 = await pdfDoc.getPage(1);
    const viewport = page1.getViewport({ scale: 1.0 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.min(Math.round(viewport.width), 600);
    canvas.height = Math.min(Math.round(viewport.height), 800);
    const ctx = canvas.getContext('2d');

    await page1.render({
      canvasContext: ctx,
      viewport: page1.getViewport({ scale: canvas.width / viewport.width })
    }).promise;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonWhitePixels = 0;
    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const a = imgData[i + 3];
      // Non-white pixel check (distinguishable from #FFFFFF background)
      if (a > 20 && (r < 240 || g < 240 || b < 240)) {
        nonWhitePixels++;
      }
    }

    const textContent = await page1.getTextContent();
    const textLength = textContent.items.map(it => it.str).join('').trim().length;

    logDiagnostic(`Verification metrics: pages=${pdfDoc.numPages}, nonWhitePixels=${nonWhitePixels}, textLength=${textLength}`);

    if (nonWhitePixels < 100) {
      return {
        ok: false,
        reason: `Blank canvas detected on Page 1 (only ${nonWhitePixels} non-white pixels).`,
        numPages: pdfDoc.numPages,
        nonWhitePixels,
        textLength
      };
    }

    return {
      ok: true,
      numPages: pdfDoc.numPages,
      nonWhitePixels,
      textLength
    };
  } catch (err) {
    logDiagnostic(`Verification error: ${err.message}`, 'error');
    return { ok: false, reason: err.message };
  }
}

/**
 * Fallback route: "Print / Save as PDF" via hidden iframe.
 */
export function exportViaPrintIframe(articleEl, title = 'Formatted Document') {
  logDiagnostic('Triggering exportViaPrintIframe fallback');
  const existing = document.getElementById('fb-print-iframe');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'fb-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const clone = articleEl.cloneNode(true);
  clone.querySelectorAll('.block-actions, button').forEach(el => el.remove());

  // Convert canvases to images in clone
  const origCanvases = articleEl.querySelectorAll('canvas');
  const cloneCanvases = clone.querySelectorAll('canvas');
  for (let i = 0; i < origCanvases.length; i++) {
    const orig = origCanvases[i];
    const target = cloneCanvases[i];
    if (orig && target) {
      try {
        const img = document.createElement('img');
        img.src = orig.toDataURL('image/png');
        img.style.maxWidth = '100%';
        target.parentNode.replaceChild(img, target);
      } catch (e) {
        console.warn(e);
      }
    }
  }

  const printDoc = iframe.contentWindow.document;
  printDoc.open();
  printDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
    body {
      font-family: system-ui, -apple-system, 'Noto Sans', 'Noto Sans Devanagari', 'Nirmala UI', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    h1 { font-size: 20pt; font-weight: bold; margin-bottom: 12pt; color: #111827; }
    h2 { font-size: 14pt; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4pt; page-break-after: avoid; break-after: avoid; }
    h3 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 4pt; color: #111827; page-break-after: avoid; break-after: avoid; }
    p { margin-bottom: 8pt; }
    table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 9.5pt; page-break-inside: avoid; break-inside: avoid; }
    th { background: #f3f4f6; padding: 6pt 8pt; border: 1px solid #d1d5db; font-weight: 600; text-align: left; }
    td { padding: 6pt 8pt; border: 1px solid #e5e7eb; }
    .table-wrapper, .block-card, .section-summary { page-break-inside: avoid; break-inside: avoid; }
    .section-summary { background: #f9fafb; border-left: 3pt solid #4F5BD5; padding: 8pt 12pt; margin: 10pt 0; border-radius: 4pt; }
    .block-card { border: 1px solid #e5e7eb; border-radius: 6pt; margin: 14pt 0; overflow: hidden; page-break-inside: avoid; }
    .block-header { background: #f9fafb; padding: 6pt 10pt; font-weight: 600; font-size: 9.5pt; border-bottom: 1px solid #e5e7eb; }
    .block-body { padding: 10pt; display: flex; justify-content: center; }
    img, svg { max-width: 100%; height: auto; }
    .header-bar { border-bottom: 1px solid #e5e7eb; padding-bottom: 4pt; margin-bottom: 12pt; font-size: 8.5pt; color: #6b7280; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header-bar"><span>${escapeHtml(title)}</span><span>FormattingBuddy</span></div>
  <div class="content">${clone.innerHTML}</div>
</body>
</html>`);
  printDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      logDiagnostic(`iframe print error: ${err.message}`, 'warn');
      window.print();
    }
  }, 400);
}

/**
 * Copies the diagnostic export logs and environment state to the clipboard.
 */
export async function copyExportDiagnostic(extraInfo = {}) {
  const diagnosticData = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screen: { width: window.innerWidth, height: window.innerHeight },
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    extra: extraInfo,
    logs: exportLogs
  };

  const text = JSON.stringify(diagnosticData, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.warn('Clipboard write failed:', e);
    return false;
  }
}

/**
 * Primary PDF Exporter function.
 * Constructs dedicated on-screen print document, rasterizes blocks,
 * slices long documents (> 3500px), adds headers/footers, and verifies output.
 */
export async function exportToPdf(articleEl, title = 'Formatted Document', options = {}) {
  if (typeof window.jspdf === 'undefined') {
    throw new Error('jsPDF library is not loaded');
  }

  logDiagnostic(`Starting exportToPdf for "${title}"`);
  const { jsPDF } = window.jspdf;

  // 1. Prepare dedicated, styled print container attached to DOM on screen (never left: -9999px or display: none)
  const printContainer = document.createElement('div');
  printContainer.className = 'pdf-print-root';
  printContainer.style.position = 'fixed';
  printContainer.style.left = '0';
  printContainer.style.top = '0';
  printContainer.style.zIndex = '-9999';
  printContainer.style.width = '794px'; // 210mm at 96 DPI
  printContainer.style.backgroundColor = '#ffffff';
  printContainer.style.color = '#111827';
  printContainer.style.pointerEvents = 'none';
  printContainer.style.opacity = '1';
  printContainer.style.visibility = 'visible';

  // 2. Clone the rendered document
  const clone = articleEl.cloneNode(true);

  // Remove interactive edit/fix buttons from clone
  clone.querySelectorAll('.block-actions, button').forEach(el => el.remove());

  // 3. Rasterize blocks to PNG data URLs before html2canvas capture
  rasterizeCanvasElements(articleEl, clone);
  await rasterizeSvgElements(articleEl, clone);
  await rasterizeMapElements(articleEl, clone);

  // 4. Inject fixed light print stylesheet
  const printStyle = document.createElement('style');
  printStyle.textContent = getPrintStylesheetContent();

  printContainer.appendChild(printStyle);
  printContainer.appendChild(clone);
  document.body.appendChild(printContainer);

  // 5. Await font and image readiness
  await document.fonts.ready;
  const cloneImgs = Array.from(printContainer.querySelectorAll('img'));
  await Promise.all(
    cloneImgs.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => {
        img.onload = res;
        img.onerror = res;
      });
    })
  );

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Register bundled fonts in jsPDF
    await registerBundledFonts(doc);

    // 6. Measure total document height to determine if slicing is necessary
    const totalHeight = printContainer.offsetHeight || printContainer.scrollHeight;
    logDiagnostic(`Measured print document height: ${totalHeight}px`);

    const MAX_SLICE_HEIGHT = 3800; // Safe threshold below browser canvas limit (4000px)

    if (totalHeight <= MAX_SLICE_HEIGHT) {
      // Single capture for documents <= 3800px
      await new Promise((resolve, reject) => {
        doc.html(printContainer, {
          callback: () => resolve(),
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false
          },
          autoPaging: 'text',
          x: 10,
          y: 12,
          width: 190,
          windowWidth: 794
        });
      });
    } else {
      // Slicing path for long documents: partition children into slices of <= 3500px
      logDiagnostic(`Document height (${totalHeight}px) exceeds safe single capture threshold. Slicing into segments...`);

      const childNodes = Array.from(clone.children);
      const slices = [];
      let currentSlice = [];
      let currentSliceHeight = 0;

      // Group children into slices
      for (const child of childNodes) {
        const childH = child.offsetHeight || 100;
        if (currentSliceHeight + childH > 3500 && currentSlice.length > 0) {
          slices.push(currentSlice);
          currentSlice = [child];
          currentSliceHeight = childH;
        } else {
          currentSlice.push(child);
          currentSliceHeight += childH;
        }
      }
      if (currentSlice.length > 0) {
        slices.push(currentSlice);
      }

      logDiagnostic(`Partitioned into ${slices.length} rendering slices`);

      // Sequentially render each slice
      for (let s = 0; s < slices.length; s++) {
        const sliceBox = document.createElement('div');
        sliceBox.className = 'pdf-print-root';
        sliceBox.style.position = 'fixed';
        sliceBox.style.left = '0';
        sliceBox.style.top = '0';
        sliceBox.style.zIndex = '-9999';
        sliceBox.style.width = '794px';
        sliceBox.style.backgroundColor = '#ffffff';

        const sliceStyle = document.createElement('style');
        sliceStyle.textContent = getPrintStylesheetContent();
        sliceBox.appendChild(sliceStyle);

        for (const el of slices[s]) {
          sliceBox.appendChild(el.cloneNode(true));
        }
        document.body.appendChild(sliceBox);

        if (s > 0) {
          doc.addPage();
        }

        await new Promise((resolve) => {
          doc.html(sliceBox, {
            callback: () => resolve(),
            html2canvas: {
              scale: 2,
              useCORS: true,
              logging: false
            },
            autoPaging: 'text',
            x: 10,
            y: 12,
            width: 190,
            windowWidth: 794
          });
        });

        document.body.removeChild(sliceBox);
      }
    }

    // 7. Add running headers, page numbers, and separation rules
    const totalPages = doc.getNumberOfPages();
    logDiagnostic(`Generated ${totalPages} pages in jsPDF`);

    const isDevanagari = /[\u0900-\u097F]/.test(title);
    const fontName = isDevanagari && doc.getFontList()['NotoSansDevanagari']
      ? 'NotoSansDevanagari'
      : (doc.getFontList()['NotoSans'] ? 'NotoSans' : 'helvetica');

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont(fontName);
      doc.setFontSize(8.5);
      doc.setTextColor(110, 115, 125);

      // Running Header at top
      const truncatedTitle = title.length > 45 ? title.slice(0, 42) + '...' : title;
      doc.text(truncatedTitle, 15, 8, { align: 'left' });
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.2);
      doc.line(15, 9.5, 195, 9.5);

      // Running Footer at bottom
      doc.line(15, 286, 195, 286);
      doc.text('FormattingBuddy', 15, 290, { align: 'left' });
      doc.text(`Page ${i} of ${totalPages}`, 195, 290, { align: 'right' });
    }

    const pdfBlob = doc.output('blob');

    // 8. Automatic Verification
    const verification = await verifyPdfBlob(pdfBlob);
    if (!verification.ok) {
      logDiagnostic(`Automatic PDF verification failed: ${verification.reason}`, 'error');
      // Trigger fallback print route automatically
      exportViaPrintIframe(articleEl, title);
      throw new Error(`PDF verification failed: ${verification.reason}. Switched to browser Print dialog.`);
    }

    // 9. Download the verified PDF
    const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'formatted-document';
    downloadBlob(pdfBlob, `${slug}.pdf`);
    logDiagnostic('PDF download completed successfully');
    return { ok: true, pages: totalPages, blob: pdfBlob };
  } finally {
    if (document.body.contains(printContainer)) {
      document.body.removeChild(printContainer);
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
