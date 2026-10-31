/**
 * FormattingBuddy - Optical Character Recognition (OCR) Engine
 * Mode 1: Fast & Private (Local Tesseract.js Worker with English & Hindi)
 * Mode 2: Better Accuracy (AI Vision Provider)
 * Renders pages at 200-300 DPI grayscale, caches results per page in IndexedDB.
 */
import { getCachedOcrPage, setCachedOcrPage } from './db.js';
import { providers } from './providers.js';

let tesseractWorker = null;
let currentWorkerLang = null;

async function getTesseractWorker(language = 'eng') {
  if (typeof window.Tesseract === 'undefined') {
    throw new Error('Tesseract.js library not loaded. Please ensure vendor/tesseract.min.js is present.');
  }

  const langCode = language === 'Hindi' ? 'hin' : 'eng';

  // If worker exists and is already configured for this language, reuse it
  if (tesseractWorker && currentWorkerLang === langCode) {
    return tesseractWorker;
  }

  // If language changed, terminate existing worker
  if (tesseractWorker && currentWorkerLang !== langCode) {
    try {
      await tesseractWorker.terminate();
    } catch {
      // ignore
    }
    tesseractWorker = null;
  }

  tesseractWorker = await window.Tesseract.createWorker(langCode, 1, {
    workerPath: './vendor/tesseract-worker.min.js',
    corePath: './vendor/tesseract-core.wasm.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: (m) => {
      if (m.status && m.progress) {
        console.log(`[Tesseract ${langCode}] ${m.status}: ${Math.round(m.progress * 100)}%`);
      }
    }
  });

  currentWorkerLang = langCode;
  return tesseractWorker;
}

/**
 * Render a single PDF.js page onto an off-screen grayscale canvas at ~250 DPI
 */
export async function renderPageToGrayscaleCanvas(page, dpiScale = 2.2) {
  const viewport = page.getViewport({ scale: dpiScale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  await page.render({
    canvasContext: ctx,
    viewport: viewport
  }).promise;

  // Convert to high-contrast grayscale for optimal OCR accuracy
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas;
}

/**
 * Convert an image file (File or Blob) to an off-screen grayscale canvas
 */
export async function renderImageToGrayscaleCanvas(imageFile) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      // Convert to grayscale
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for OCR processing.'));
    };
    img.src = url;
  });
}

export class OcrRunner {
  constructor(options = {}) {
    this.pdfDocument = options.pdfDocument || null;
    this.imageFile = options.imageFile || null;
    this.docId = options.docId || `doc_${Date.now()}`;
    this.mode = options.mode || 'local'; // 'local' or 'vision'
    this.language = options.language || 'English';
    this.pagesToProcess = options.pages || []; // array of page numbers e.g. [1, 2]
    this.onProgress = options.onProgress || (() => {});
    this.isCancelled = false;
  }

  cancel() {
    this.isCancelled = true;
  }

  async run() {
    // If it's a standalone image file
    if (this.imageFile && !this.pdfDocument) {
      return await this.runSingleImage();
    }

    if (!this.pdfDocument) {
      throw new Error('No PDF document or image loaded for OCR.');
    }

    const total = this.pagesToProcess.length;
    const extractedPages = {};
    const startTime = Date.now();

    for (let i = 0; i < total; i++) {
      if (this.isCancelled) {
        throw new Error('OCR process cancelled by user.');
      }

      const pageNum = this.pagesToProcess[i];
      const elapsed = Date.now() - startTime;
      const avgPerPage = i > 0 ? elapsed / i : 5000;
      const remainingSeconds = Math.max(1, Math.round(((total - i) * avgPerPage) / 1000));

      this.onProgress({
        currentPage: pageNum,
        index: i + 1,
        total: total,
        percent: Math.round((i / total) * 100),
        status: `Running OCR on page ${pageNum} (${i + 1}/${total}) - ~${remainingSeconds}s remaining...`
      });

      // 1. Check IndexedDB cache first
      const cached = await getCachedOcrPage(this.docId, pageNum);
      if (cached) {
        extractedPages[pageNum] = cached;
        continue;
      }

      // 2. Render page to ~250 DPI grayscale canvas
      const page = await this.pdfDocument.getPage(pageNum);
      const canvas = await renderPageToGrayscaleCanvas(page, 2.2);

      let pageText = '';

      if (this.mode === 'vision') {
        // Mode B: AI Vision OCR
        pageText = await this.performAiVisionOcr(canvas, pageNum);
      } else {
        // Mode A: Local Tesseract.js OCR
        pageText = await this.performLocalOcr(canvas);
      }

      // Cleanup canvas memory
      canvas.width = 1;
      canvas.height = 1;

      extractedPages[pageNum] = pageText;
      // Cache in IndexedDB
      await setCachedOcrPage(this.docId, pageNum, pageText, this.mode);
    }

    this.onProgress({
      currentPage: this.pagesToProcess[total - 1] || 1,
      index: total,
      total: total,
      percent: 100,
      status: 'OCR text extraction complete.'
    });

    return extractedPages;
  }

  async runSingleImage() {
    this.onProgress({
      currentPage: 1,
      index: 1,
      total: 1,
      percent: 30,
      status: 'Converting image to high-contrast canvas...'
    });

    const canvas = await renderImageToGrayscaleCanvas(this.imageFile);
    let text = '';

    this.onProgress({
      currentPage: 1,
      index: 1,
      total: 1,
      percent: 60,
      status: this.mode === 'vision' ? 'Transcribing via AI Vision...' : 'Transcribing via on-device OCR...'
    });

    if (this.mode === 'vision') {
      text = await this.performAiVisionOcr(canvas, 1);
    } else {
      text = await this.performLocalOcr(canvas);
    }

    canvas.width = 1;
    canvas.height = 1;

    this.onProgress({
      currentPage: 1,
      index: 1,
      total: 1,
      percent: 100,
      status: 'Image OCR complete.'
    });

    return { 1: text };
  }

  async performLocalOcr(canvas) {
    try {
      const worker = await getTesseractWorker(this.language);
      const ret = await worker.recognize(canvas);
      return ret.data.text ? ret.data.text.trim() : '';
    } catch (err) {
      console.warn('Local OCR failed:', err);
      throw new Error(`Local OCR Error: ${err.message}. Consider switching to AI Vision mode.`);
    }
  }

  async performAiVisionOcr(canvas, pageNum) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const base64Data = dataUrl.split(',')[1];

    // Determine active vision provider (defaulting to Gemini or first enabled)
    const available = providers.getEnabledProviders();
    const providerId = available.includes('gemini') ? 'gemini' : (available[0] || 'gemini');

    const systemPrompt = `You are an expert OCR transcription engine.
Transcribe all text from the provided document page accurately.
Preserve table structure, headings, lists, numbers, and bullet points.
Output only the transcribed text/markdown. Do not add conversational commentary.`;

    const userPrompt = `Perform OCR on page ${pageNum} of this document.`;

    if (providerId === 'gemini') {
      const key = providers.getKey('gemini');
      if (!key) throw new Error('API key for Gemini is required for AI Vision OCR. Please configure it in Settings.');

      const model = providers.getSettings('gemini').model || 'gemini-2.5-flash';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              parts: [
                { text: userPrompt },
                { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
              ]
            }
          ]
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Vision OCR Error HTTP ${res.status}: ${errorText}`);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // Fallback to completion
    return await providers.generateCompletion(providerId, systemPrompt, userPrompt);
  }
}
