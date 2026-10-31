# 📄 FormattingBuddy

<p align="center">
  <img src="assets/icons/icon.svg" width="96" height="96" alt="FormattingBuddy Logo" />
</p>

<p align="center">
  <strong>Convert long plain-text files and multi-format documents (PDF, Word, PPTX, Excel, Images up to 20 MB) into structured, publication-ready reports, guides, and manuals.</strong><br>
  <em>Pure static Progressive Web App (PWA): zero frameworks, zero build steps, zero backend, and zero server storage.</em>
</p>

<p align="center">
  <a href="https://harshverse-svg.github.io/formattingbuddy/"><img src="https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-4F5BD5?style=for-the-badge&logo=github" alt="Live Demo" /></a>
  <a href="#-file-input-up-to-20-mb"><img src="https://img.shields.io/badge/File%20Intake-Up%20to%2020%20MB-blue?style=for-the-badge" alt="20 MB File Intake" /></a>
  <a href="#-optical-character-recognition-ocr"><img src="https://img.shields.io/badge/OCR-Local%20WASM%20%2B%20AI%20Vision-0D9488?style=for-the-badge" alt="OCR Support" /></a>
  <a href="#-export-formats"><img src="https://img.shields.io/badge/Exports-PDF%20%7C%20HTML%20%7C%20DOCX%20%7C%20MD%20%7C%20ZIP-10B981?style=for-the-badge" alt="Exports" /></a>
  <a href="#-security--zero-backend-architecture"><img src="https://img.shields.io/badge/Security-AES--GCM%20%2B%20PBKDF2-38BDF8?style=for-the-badge" alt="Security" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray?style=for-the-badge" alt="License" /></a>
</p>

---

## 🌐 Live Application

👉 **Try it directly in your browser:** **[https://harshverse-svg.github.io/formattingbuddy/](https://harshverse-svg.github.io/formattingbuddy/)**

*Installs as a standalone PWA and runs completely offline.*

---

## ⚡ What is FormattingBuddy?

When working with long raw texts, meeting transcripts, unorganized notes, research papers, or legacy documentation, turning them into executive-ready documents is time-consuming. 

**FormattingBuddy** automates this entire pipeline client-side:
1. **Multi-Format Document Intake**: Drag and drop documents up to **20 MB** (PDF, Word DOCX, PowerPoint PPTX, Excel XLSX/CSV, Markdown, HTML, JSON, or Images).
2. **Web Worker Extraction & Cleaning**: Extracted text is stripped of recurring headers/footers and page numbers, and repaired for broken hyphenation without freezing the UI.
3. **Scanned Document OCR**: Automatically detects non-searchable pages and offers on-device **Fast & Private (Local Tesseract.js)** or **High-Accuracy (AI Vision)** transcription.
4. **Context-Aware Semantic Chunking**: Splits large documents into 1,500–2,500 word sections at heading or page boundaries with small overlaps and continuous running summaries.
5. **IndexedDB SHA-256 Chunk Caching**: Cached by text hash so retries and provider switches never repeat completed work.
6. **Automatic Visual Enrichments**:
   - **Mermaid Diagrams**: Processes, timelines, and hierarchies rendered with auto-repair and fallback.
   - **Data Charts**: Numeric trends and comparisons rendered with theme-aware Chart.js.
   - **Geographic Maps**: Locations geocoded via OpenStreetMap Nominatim and mapped with Leaflet.
7. **Client-Side Document Export**: Generates print-ready **A4 PDF** (with TOC and page numbers), real **Microsoft Word (.docx)** with embedded tables and images, standalone **offline HTML**, **Markdown**, and **ZIP** bundles.

---

## 📐 Modern Design & Themes

Designed with a minimal, modern Linear/Notion-inspired aesthetic adhering to strict anti-slop guidelines:
- **3 Cohesive Themes**:
  - **Light (Soft Blue)**: bg `#EAF0FA`, surface `#F5F8FD`, border `#D3DCEC`, text `#1B2433`, muted `#5B6780`, accent `#4F5BD5`. (No harsh pure white or pure black).
  - **Dark (Midnight)**: bg `#0D1220`, surface `#151B2D`, border `#25304A`, text `#E6EAF5`, muted `#8E9AB8`, accent `#7C86F2`.
  - **Slate (Gray-Blue)**: bg `#1E2530`, surface `#273140`, border `#384556`, text `#E2E8F0`, muted `#94A3B8`, accent `#60A5FA`.
- **Status Colors per Theme**: Sky (Info), Teal (Success), Amber (Warning), Rose (Error).
- **Logo & Splash**: Vector document glyph with AI transformation sparkle node, official wordmark, and a clean 1-second session splash screen (skipped if `prefers-reduced-motion`).
- **Responsive Split Screen**: Two panels on desktop (`Source Document` on left, `Formatted Document` on right), and intuitive tab navigation on mobile.
- **Status Bar**: Real-time bottom bar showing active AI provider/model, storage footprint, and a one-click button to clear stored files and caches.
- **Language Options**: English, **Hindi (हिंदी)**, Spanish, French, German, Chinese, and Japanese.

```
+-------------------------------------------------------------------------------------------------------------------+
|  [Logo] FormattingBuddy         ● Ready    [Install PWA] [Help (?)] [Theme] [Settings (Keys & Reset)] [Lock]      |
+----------------------------------------------------+--------------------------------------------------------------+
| LEFT: Source Document & Options                    | RIGHT: Formatted Document & Preview                          |
|                                                    |                                                              |
| [Doc Type: Report] [Language: Hindi] [Visuals]     | [View Markdown]  [Download Menu v]                           |
|                                                    |   - PDF Document (.pdf)                                      |
| +------------------------------------------------+ |   - Offline HTML (.html)                                     |
| | Drag & drop PDF, Word DOCX, PPTX, Excel, Images | |   - Word Document (.docx)                                    |
| | (up to 20 MB) or paste unformatted text...     | |   - Raw Markdown (.md)                                       |
| |                                                | |   - Document Bundle (.zip)                                   |
| +------------------------------------------------+ |                                                              |
| 3,250 words | Max 20 MB | Resave .doc/.ppt       | Table of Contents                                            |
|                                                    | 1. Executive Summary                                         |
| Provider: [Auto (fallback) v]     [  Convert  ]    | 2. Architecture Diagram (Mermaid)                            |
|                                                    | 3. Regional Metrics (Chart.js & Leaflet Map)                 |
+----------------------------------------------------+--------------------------------------------------------------+
| ● Provider: Auto fallback (3 ready)                | Storage: 1 file, 3 cached sections (2.4 MB)  [Clear Files]   |
+-------------------------------------------------------------------------------------------------------------------+
```

---

## 📂 File Input Up to 20 MB

FormattingBuddy accepts documents up to **20 MB** without uploading anything to a backend:

| Format | Extension | Extractor | Features Extracted |
| :--- | :--- | :--- | :--- |
| **PDF** | `.pdf` | PDF.js (Local Worker) | Digital text layer, page boundaries, automatic scanned page detection |
| **Word** | `.docx` | Mammoth.js (Local Worker) | Heading styles, bullet/numbered lists, tables, inline text formatting |
| **PowerPoint** | `.pptx` | JSZip + DrawingML parser | Slide titles, slide outlines, speaker content per slide |
| **Spreadsheets**| `.xlsx`, `.xls`, `.csv` | SheetJS (Local Worker) | Multi-sheet workbooks converted to clean Markdown tables |
| **Text & Web** | `.txt`, `.md`, `.html`, `.json` | TextDecoder | Tag stripping, JSON tree pretty-printing, markdown preservation |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.webp`| Canvas + OCR Engine | High-contrast grayscale conversion ready for transcription |

> **⚠️ Legacy Office Files:** Older binary `.doc` and `.ppt` files are not supported. Please open them in Microsoft Office or LibreOffice and Save As `.docx` or `.pptx` before uploading.

---

## 👁️ Optical Character Recognition (OCR)

When a document without a digital text layer (e.g. scanned contracts, photographed receipts, or image files) is uploaded, FormattingBuddy flags the pages and offers two processing modes:

1. **Fast & Private (Local Tesseract.js)**:
   - Runs 100% on your device using WebAssembly (`tesseract-core.wasm`).
   - Zero network transmission — images never leave your browser.
   - Built-in support for **English** and **Hindi**.
   - Language data is automatically cached by the Service Worker for offline use.
2. **Better Accuracy (AI Vision)**:
   - Renders page frames at ~250 DPI grayscale and sends them to your configured vision AI provider (default: **Gemini 2.5 Flash**).
   - Ideal for handwritten notes, multi-column layouts, and degraded scans.

Both modes cache page transcripts in **IndexedDB** so you never re-run OCR on the same document twice.

---

## 🔒 Security & Zero-Backend Architecture

> **Your API keys and documents never touch a third-party server.**

```
+---------------------------------------------------------------------------------------+
|                                    YOUR BROWSER                                       |
|                                                                                       |
|  [Passcode] --(PBKDF2 100,000 iters)--> [Verification Hash] --> localStorage          |
|                                     --> [AES-GCM 256-bit Key]                         |
|                                                 |                                     |
|  [Plaintext API Keys] --(AES-GCM Encrypt)--------+--> [Encrypted Keys] --> localStorage|
|                                                 |                                     |
|  [Decrypted Keys in RAM only] <-----------------+                                     |
|           |                                                                           |
|           +---- Direct HTTPS Request ----> [AI Provider: Gemini, Groq, Claude, etc.]  |
+---------------------------------------------------------------------------------------+
```

1. **Web Crypto Architecture**:
   - Master passcode derived via standard browser **PBKDF2** (100,000 iterations, SHA-256) with a cryptographically secure 16-byte random salt.
   - In-memory **AES-GCM 256-bit** key encrypts sensitive provider credentials in local storage.
2. **Strict Data Privacy**:
   - **API Keys**: Stored encrypted in local storage, decrypted only in memory when unlocked, and sent **ONLY** to the specific AI provider you select.
   - **Document Text**: Transmitted **ONLY** to your selected AI provider for document formatting.
   - **Place Names**: Queried against OpenStreetMap Nominatim strictly for map block geocoding.
   - **Local OCR**: Scanned document images are processed entirely on your device inside a WebAssembly worker (Tesseract.js)—images never leave your computer.
3. **Offline Scope**:
   - Offline mode works for the application shell, document parsers, local OCR, and export modules (PDF, DOCX, HTML, ZIP, Markdown).
   - Remote AI completions require network connectivity to reach your chosen provider.
4. **Strict Content-Security-Policy (CSP)**:
   - Restricts script execution to local files (`'self'`).
   - All vendor libraries are bundled locally in the repository (no runtime CDNs).

---

## 🤖 Supported AI Providers

FormattingBuddy integrates 8 AI providers with editable model fields, a **Refresh models** discovery button, and an intelligent **Auto (fallback)** engine:

| Provider | Default Model | Get an API Key | Key Features |
| :--- | :--- | :--- | :--- |
| **Google Gemini** | `gemini-2.5-flash` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Fast multimodal engine, generous free tier |
| **Groq** | `llama-3.3-70b-versatile` | [console.groq.com/keys](https://console.groq.com/keys) | Ultra-low latency LPU inference |
| **OpenRouter** | `google/gemini-2.5-flash` | [openrouter.ai/keys](https://openrouter.ai/keys) | Access hundreds of open & commercial models |
| **Mistral AI** | `mistral-small-latest` | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) | High reasoning quality and multilingual support |
| **Ollama Cloud / Local** | `llama3.2` | [ollama.com/settings/keys](https://ollama.com/settings/keys) | Cloud or local self-hosted endpoint (`localhost:11434`) |
| **Hugging Face** | `Qwen/Qwen2.5-72B-Instruct` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | Serverless inference router for open weights |
| **Anthropic Claude** | `claude-haiku-5-5` | [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys) | Direct browser-access enabled API calls |
| **Custom OpenAI-Compatible**| Custom | Provider-specific | Compatible with vLLM, LM Studio, Together, Perplexity |

### 🔄 Auto (Fallback) Mode
When **Auto (fallback)** is selected, FormattingBuddy monitors API responses. If a provider hits an HTTP `429` (rate limit/quota) or `5xx` (server outage), it automatically switches to the next configured provider, preserving chunk progress and resuming seamlessly.

---

## 📦 Export Formats

Export your formatted document in one click from the **Download** menu:

- **📄 PDF (A4 Document)**:
  - Formatted for printing on A4 paper.
  - Page breaks strictly avoid splitting tables, callouts, or diagrams (`break-inside: avoid`).
  - Includes a Table of Contents, running header, and `"Page X of Y"` footers.
  - Converts SVG diagrams, canvas charts, and map tiles into crisp print images.
- **📝 Microsoft Word (.docx)**:
  - Real native `.docx` document with heading hierarchy (`Heading 1`, `Heading 2`, `Heading 3`).
  - Formatted Word tables with styled headers.
  - Diagrams and charts captured and embedded as inline Word images.
- **🌐 Offline HTML**:
  - Standalone, self-contained single `.html` file.
  - Inlines all CSS, SVGs, and base64 chart images. Opens completely offline without an internet connection.
- **📑 Raw Markdown**:
  - Clean `.md` file ready for Obsidian, Notion, GitHub, or static site generators.
- **📦 Document Bundle (ZIP)**:
  - Includes `document.md`, `document.html`, and a dedicated `images/` directory containing all chart and diagram assets.

---

## 🧪 Built-In Demo Samples

Want to test without pasting your own text? Use the **Load Sample** menu:

1. **⚙️ Process Sample**: Continuous integration and container canary rollout workflow (triggers a 12-node Mermaid diagram and verification tables).
2. **📊 Data Heavy Sample**: Enterprise cloud computing quarterly growth report (triggers Chart.js bar and doughnut charts).
3. **🗺️ Locations Sample**: European technology innovation centers (triggers Nominatim geocoding and Leaflet map markers across 6 metropolitan capitals).

---

## 📱 PWA Installation

FormattingBuddy is a Progressive Web App (PWA). Once installed or cached, the application shell, document parsers, local OCR engine, and export generators operate offline without an internet connection.

- **Desktop (Chrome / Edge / Brave)**:
  Click the **"Install"** button in the top navigation bar, or click the install icon in the URL bar.
- **iOS / iPadOS (Safari)**:
  Tap the **Share** button &rarr; tap **"Add to Home Screen"**.
- **Android (Chrome)**:
  Tap the menu (⋮) &rarr; tap **"Install app"** or **"Add to Home screen"**.

---

## 🛠️ Local Development

FormattingBuddy requires no compilation, bundler, or build tool.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/harshverse-svg/formattingbuddy.git
   cd formattingbuddy
   ```

2. **Start a local web server**:
   - Using Python:
     ```bash
     python -m http.server 8080
     ```
   - Using Node:
     ```bash
     npx serve .
     ```

3. **Open the app**:
   Navigate to `http://localhost:8080`.

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
