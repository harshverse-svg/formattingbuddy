/**
 * FormattingBuddy - Document Parser Web Worker
 * Parses PDF, DOCX, PPTX, XLSX/CSV, TXT, MD, HTML, JSON, Images.
 * Runs in isolated thread to keep the main UI responsive.
 */

// Import bundled local libraries
import * as pdfjsLib from '../../vendor/pdf.min.mjs';
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdf.worker.min.mjs', import.meta.url).href;
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '../../vendor/pdf.worker.min.mjs';
}

import '../../vendor/jszip.min.js';
import '../../vendor/xlsx.full.min.js';
import '../../vendor/mammoth.browser.min.js';

function getMammoth() {
  return self.mammoth || globalThis.mammoth || null;
}

function getXLSX() {
  return self.XLSX || globalThis.XLSX || null;
}

function getJSZip() {
  return self.JSZip || globalThis.JSZip || null;
}

self.onmessage = async (e) => {
  const { action, fileData, fileType, fileName, fileSize } = e.data;

  if (action === 'parse') {
    try {
      const result = await parseDocument(fileData, fileName, fileType, fileSize);
      self.postMessage({ type: 'complete', result });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};

async function parseDocument(arrayBuffer, name, type, size) {
  const ext = (name.split('.').pop() || '').toLowerCase();

  // Progress helper
  const reportProgress = (percent, status) => {
    self.postMessage({ type: 'progress', percent, status });
  };

  reportProgress(10, `Reading ${name}...`);

  // 1. PDF Documents
  if (ext === 'pdf' || type === 'application/pdf') {
    return await parsePdf(arrayBuffer, reportProgress);
  }

  // 2. Microsoft Word DOCX
  if (ext === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return await parseDocx(arrayBuffer, reportProgress);
  }

  // 3. Microsoft Excel XLSX or CSV
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || type.includes('spreadsheet') || type.includes('csv')) {
    return await parseSpreadsheet(arrayBuffer, ext, reportProgress);
  }

  // 4. Microsoft PowerPoint PPTX
  if (ext === 'pptx' || type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return await parsePptx(arrayBuffer, reportProgress);
  }

  // 5. Plain Text, Markdown, HTML, JSON
  if (['txt', 'text', 'md', 'markdown', 'html', 'json'].includes(ext) || type.startsWith('text/')) {
    return await parseTextFile(arrayBuffer, ext, reportProgress);
  }

  // 6. Image Files (PNG, JPG, WEBP)
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext) || type.startsWith('image/')) {
    reportProgress(50, 'Image detected - preparing for OCR...');
    return {
      text: '',
      pageCount: 1,
      isImage: true,
      scannedPages: [1],
      hasScannedPages: true,
      metadata: { format: ext }
    };
  }

  throw new Error(`Unsupported file format ".${ext}". Supported: PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, HTML, JSON, PNG/JPG.`);
}

/* ==========================================================================
   1. PDF Parser (PDF.js)
   ========================================================================== */
async function parsePdf(arrayBuffer, reportProgress) {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      isEvalSupported: false
    });

    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    const pageTexts = [];
    const scannedPages = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const percent = 10 + Math.round((pageNum / totalPages) * 75);
      reportProgress(percent, `Extracting page ${pageNum} of ${totalPages}...`);

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const rawPageString = textContent.items.map(item => item.str).join(' ');

      // Check if page has no or very sparse text layer (< 35 non-space characters)
      const cleanChars = rawPageString.replace(/\s+/g, '');
      if (cleanChars.length < 35) {
        scannedPages.push(pageNum);
        pageTexts.push(`[Scanned Page ${pageNum} - Needs OCR]`);
      } else {
        pageTexts.push(rawPageString);
      }
    }

    reportProgress(90, 'Cleaning extracted text...');
    const cleanedText = cleanExtractedText(pageTexts);

    return {
      text: cleanedText,
      pageCount: totalPages,
      hasScannedPages: scannedPages.length > 0,
      scannedPages: scannedPages,
      metadata: { totalPages }
    };
  } catch (err) {
    if (err.name === 'PasswordException') {
      throw new Error('This PDF is password protected. Please unlock the file and upload again.');
    }
    throw new Error(`PDF Parsing Error: ${err.message}`);
  }
}

/* ==========================================================================
   2. DOCX Parser (Mammoth.js)
   ========================================================================== */
async function parseDocx(arrayBuffer, reportProgress) {
  reportProgress(40, 'Parsing DOCX structure and styles...');
  try {
    const mammoth = getMammoth();
    if (!mammoth) throw new Error('Mammoth DOCX parser not initialized.');

    // Convert directly to clean Markdown
    const result = await mammoth.convertToMarkdown({ arrayBuffer });
    const rawMarkdown = result.value || '';

    reportProgress(85, 'Cleaning Word document text...');
    const cleaned = cleanMarkdownDocument(rawMarkdown);

    // Approximate page count (~400 words per standard page)
    const words = (cleaned.match(/\S+/g) || []).length;
    const estimatedPages = Math.max(1, Math.ceil(words / 400));

    return {
      text: cleaned,
      pageCount: estimatedPages,
      hasScannedPages: false,
      scannedPages: [],
      metadata: { estimatedPages, messages: result.messages }
    };
  } catch (err) {
    throw new Error(`DOCX Parsing Error: ${err.message}`);
  }
}

/* ==========================================================================
   3. Spreadsheet Parser (SheetJS XLSX/CSV)
   ========================================================================== */
async function parseSpreadsheet(arrayBuffer, ext, reportProgress) {
  reportProgress(40, 'Parsing workbook sheets...');
  try {
    const XLSX = getXLSX();
    if (!XLSX) throw new Error('SheetJS library not initialized.');

    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const sheetNames = workbook.SheetNames;
    const parts = [];

    for (let i = 0; i < sheetNames.length; i++) {
      const sheetName = sheetNames[i];
      reportProgress(40 + Math.round(((i + 1) / sheetNames.length) * 45), `Formatting sheet "${sheetName}"...`);
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (!rows || rows.length === 0) continue;

      parts.push(`## Sheet: ${sheetName}\n`);

      // Build Markdown Table from rows
      const headerRow = rows[0] || [];
      if (headerRow.length > 0) {
        parts.push('| ' + headerRow.map(c => String(c ?? '').trim()).join(' | ') + ' |');
        parts.push('| ' + headerRow.map(() => '---').join(' | ') + ' |');

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const cells = headerRow.map((_, colIdx) => String(row[colIdx] ?? '').trim().replace(/\|/g, '\\|'));
          parts.push('| ' + cells.join(' | ') + ' |');
        }
      }
      parts.push('\n');
    }

    const finalMarkdown = parts.join('\n');
    return {
      text: finalMarkdown,
      pageCount: sheetNames.length,
      hasScannedPages: false,
      scannedPages: [],
      metadata: { sheetCount: sheetNames.length }
    };
  } catch (err) {
    throw new Error(`Spreadsheet Parsing Error: ${err.message}`);
  }
}

/* ==========================================================================
   4. PowerPoint Parser (PPTX via JSZip XML)
   ========================================================================== */
async function parsePptx(arrayBuffer, reportProgress) {
  reportProgress(40, 'Unpacking presentation slides...');
  try {
    const JSZip = getJSZip();
    if (!JSZip) throw new Error('JSZip library not initialized.');

    const zip = await JSZip.loadAsync(arrayBuffer);
    const slideFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/i));
    
    // Sort slide numbers numerically
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return numA - numB;
    });

    const slideParts = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const fileName = slideFiles[i];
      const slideNum = i + 1;
      reportProgress(40 + Math.round(((i + 1) / slideFiles.length) * 45), `Reading slide ${slideNum} of ${slideFiles.length}...`);
      
      const xmlString = await zip.files[fileName].async('text');
      const textMatches = xmlString.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
      const slideTexts = textMatches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean);

      slideParts.push(`## Slide ${slideNum}`);
      if (slideTexts.length > 0) {
        slideTexts.forEach(t => slideParts.push(`- ${t}`));
      } else {
        slideParts.push('*[No text on slide]*');
      }
      slideParts.push('');
    }

    return {
      text: slideParts.join('\n\n'),
      pageCount: slideFiles.length,
      hasScannedPages: false,
      scannedPages: [],
      metadata: { slideCount: slideFiles.length }
    };
  } catch (err) {
    throw new Error(`PPTX Parsing Error: ${err.message}`);
  }
}

/* ==========================================================================
   5. Text / Markdown / HTML / JSON Parser
   ========================================================================== */
async function parseTextFile(arrayBuffer, ext, reportProgress) {
  reportProgress(50, 'Decoding text file...');
  const decoder = new TextDecoder('utf-8');
  let text = decoder.decode(arrayBuffer);

  if (ext === 'html') {
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<h([1-6])>(.*?)<\/h\1>/gi, '\n\n## $2\n\n');
    text = text.replace(/<p>(.*?)<\/p>/gi, '\n\n$1\n\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
  } else if (ext === 'json') {
    try {
      const obj = JSON.parse(text);
      text = '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
    } catch {
      // keep raw text
    }
  }

  const words = (text.match(/\S+/g) || []).length;
  const estimatedPages = Math.max(1, Math.ceil(words / 400));

  return {
    text: cleanMarkdownDocument(text),
    pageCount: estimatedPages,
    hasScannedPages: false,
    scannedPages: [],
    metadata: { estimatedPages }
  };
}

/* ==========================================================================
   Text Cleaning Utilities:
   - Removes repeated header / footer lines across pages
   - Fixes hyphenated line breaks ("exam- ple" -> "example")
   - Normalizes whitespace
   ========================================================================== */
function cleanExtractedText(pageTexts) {
  const lineFrequency = new Map();
  const pageLines = pageTexts.map(pt => pt.split('\n').map(l => l.trim()).filter(l => l.length > 3 && l.length < 100));

  for (const lines of pageLines) {
    const seenOnThisPage = new Set();
    for (const l of lines) {
      if (!seenOnThisPage.has(l)) {
        seenOnThisPage.add(l);
        lineFrequency.set(l, (lineFrequency.get(l) || 0) + 1);
      }
    }
  }

  const threshold = Math.max(2, Math.floor(pageTexts.length * 0.5));
  const recurringLines = new Set();
  for (const [line, count] of lineFrequency.entries()) {
    if (count >= threshold) recurringLines.add(line);
  }

  const cleanedPages = [];
  for (let i = 0; i < pageTexts.length; i++) {
    const raw = pageTexts[i];
    const lines = raw.split('\n');
    const filtered = lines.filter(line => {
      const trimmed = line.trim();
      if (recurringLines.has(trimmed)) return false;
      if (/^(page\s+\d+(\s+of\s+\d+)?|\d+)$/i.test(trimmed)) return false;
      return true;
    });

    cleanedPages.push(filtered.join('\n'));
  }

  let full = cleanedPages.join('\n\n');
  full = full.replace(/(\b[a-zA-Z]{2,})-\s*\n\s*([a-zA-Z]{2,}\b)/g, '$1$2');
  full = full.replace(/\n{3,}/g, '\n\n');

  return full.trim();
}

function cleanMarkdownDocument(text) {
  if (!text) return '';
  let cleaned = text.replace(/(\b[a-zA-Z]{2,})-\s*\n\s*([a-zA-Z]{2,}\b)/g, '$1$2');
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}
