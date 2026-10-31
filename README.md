# 📄 FormattingBuddy

<p align="center">
  <img src="assets/icons/icon.svg" width="96" height="96" alt="FormattingBuddy Logo" />
</p>

<p align="center">
  <strong>Convert long plain-text files into beautifully structured documents with headings, tables, diagrams, charts, and maps.</strong><br>
  <em>Pure static Progressive Web App (PWA): zero frameworks, zero build steps, zero backend, and zero server storage.</em>
</p>

<p align="center">
  <a href="https://harshverse-svg.github.io/formattingbuddy/"><img src="https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-5B5BD6?style=for-the-badge&logo=github" alt="Live Demo" /></a>
  <a href="#-export-formats"><img src="https://img.shields.io/badge/Exports-PDF%20%7C%20HTML%20%7C%20DOCX%20%7C%20MD%20%7C%20ZIP-10B981?style=for-the-badge" alt="Exports" /></a>
  <a href="#-security--zero-backend-architecture"><img src="https://img.shields.io/badge/Security-AES--GCM%20%2B%20PBKDF2-blue?style=for-the-badge" alt="Security" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray?style=for-the-badge" alt="License" /></a>
</p>

---

## 🌐 Live Application

👉 **Try it directly in your browser:** **[https://harshverse-svg.github.io/formattingbuddy/](https://harshverse-svg.github.io/formattingbuddy/)**

*Works completely offline once installed as a PWA.*

---

## ⚡ What is FormattingBuddy?

When working with long raw texts, meeting transcripts, unorganized notes, research papers, or legacy documentation, turning them into executive-ready documents is time-consuming. 

**FormattingBuddy** automates this entire pipeline client-side:
1. **Intelligent Text Chunking**: Splits large documents (up to 2 MB) into 1,500–2,500 word segments strictly at paragraph boundaries.
2. **Context-Aware AI Formatting**: Converts raw paragraphs into semantic Markdown with consistent H1/H2/H3 hierarchies, comparable data tables, and section summaries without inventing facts.
3. **Automatic Visual Enrichments**:
   - **Mermaid Diagrams**: Converts workflows, timelines, and hierarchies into interactive diagrams with automatic syntax validation and error auto-repair.
   - **Data Charts**: Renders financial metrics and numbers into native Chart.js visualizations (bar, line, doughnut, pie).
   - **Geographic Maps**: Geocodes locations via OpenStreetMap Nominatim and renders interactive maps with Leaflet.
4. **Multi-Format Document Export**: Generates professional **A4 PDF** with page numbers and no split tables, real **Microsoft Word (.docx)** with embedded tables and images, self-contained **offline HTML**, **Markdown**, and **ZIP** bundles.

---

## 📐 Layout & Interface Design

Designed with a minimal, modern Linear/Notion-inspired aesthetic:
- **3 Cohesive Themes**:
  - **Light (Soft Blue)**: bg `#EAF0FA`, surface `#F5F8FD`, border `#D3DCEC`, text `#1B2433`, muted `#5B6780`, accent `#4F5BD5`. (No harsh pure white or pure black).
  - **Dark (Midnight)**: bg `#0D1220`, surface `#151B2D`, border `#25304A`, text `#E6EAF5`, muted `#8E9AB8`, accent `#7C86F2`.
  - **Slate (Gray-Blue)**: bg `#1E2530`, surface `#273140`, border `#384556`, text `#E2E8F0`, muted `#94A3B8`, accent `#60A5FA`.
- **Status Colors per Theme**: Sky (Info), Teal (Success), Amber (Warning), Rose (Error).
- **Logo & Splash**: Vector document glyph with AI sparkle node, official wordmark, and a clean 1-second session splash screen.
- **Responsive Split Screen**: Two panels on desktop (`Source Text` on left, `Formatted Document` on right), and intuitive tab navigation on mobile.
- **Performance**: 150ms transitions, zero heavy background animation loops, lightweight CPU footprint. Strictly AA contrast compliant.

```
+---------------------------------------------------------------------------------------------------+
|  [Logo] FormattingBuddy        ● Ready      [Install PWA]  [Theme]  [Settings (Keys)]  [Lock] [Reset] |
+-------------------------------------------------+-------------------------------------------------+
| LEFT: Source Text & Options                     | RIGHT: Formatted Document & Preview             |
|                                                 |                                                 |
| [Doc Type: Report] [Language] [Visuals: Rich]   | [View Markdown]  [Download Menu v]              |
|                                                 |   - PDF Document (.pdf)                         |
| +---------------------------------------------+ |   - Offline HTML (.html)                        |
| | Drag & drop .txt or .md (up to 2 MB)        | |   - Word Document (.docx)                       |
| | or paste unformatted text here...           | |   - Raw Markdown (.md)                          |
| |                                             | |   - Document Bundle (.zip)                      |
| |                                             | |                                                 |
| |                                             | | Table of Contents                               |
| +---------------------------------------------+ | 1. Introduction                                 |
| 2,450 words | Max 2 MB | Split 1.5k-2.5k words | 2. Architecture Diagram (Mermaid)               |
|                                                 | 3. Performance Metrics (Chart.js)               |
| Provider: [Auto (fallback) v]  [  Convert  ]    | 4. Regional Centers (Leaflet Map)               |
+-------------------------------------------------+-------------------------------------------------+
```

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

1. **Hardware-Grade Web Crypto**:
   - Master passcode derived via **PBKDF2** (100,000 iterations, SHA-256) with a cryptographically secure 16-byte random salt.
   - Verification hash stored in `localStorage`.
   - In-memory **AES-GCM 256-bit** key encrypts sensitive provider credentials.
2. **Ephemeral Memory Storage**:
   - API keys are decrypted only in JavaScript runtime memory while the workspace is unlocked.
   - Keys are wiped from memory immediately upon locking or after **15 minutes of inactivity**.
   - Keys are never placed in URLs, never logged to console, and never sent anywhere except directly to the provider endpoint chosen by the user.
3. **Strict Content-Security-Policy (CSP)**:
   - Restricts script execution to local files (`'self'`).
   - No external CDN dependencies at runtime.
   - All vendor libraries are bundled locally in the repository.

---

## 🤖 Supported AI Providers

FormattingBuddy integrates 8 AI providers with support for custom models, base URLs, and an intelligent **Auto (fallback)** engine:

| Provider | Default Model | Get an API Key | Key Features |
| :--- | :--- | :--- | :--- |
| **Google Gemini** | `gemini-2.5-flash` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Generous free tier, fast multimodal engine |
| **Groq** | `llama-3.3-70b-versatile` | [console.groq.com/keys](https://console.groq.com/keys) | Ultra-low latency LPU inference |
| **OpenRouter** | `google/gemini-2.5-flash` | [openrouter.ai/keys](https://openrouter.ai/keys) | Access hundreds of open & commercial models |
| **Mistral AI** | `mistral-small-latest` | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) | High reasoning quality and multilingual support |
| **Ollama Cloud / Local** | `llama3.2` | [ollama.com/settings/keys](https://ollama.com/settings/keys) | Cloud or local self-hosted endpoint (`localhost:11434`) |
| **Hugging Face** | `Qwen/Qwen2.5-72B-Instruct` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | Serverless inference router for open weights |
| **Anthropic Claude** | `claude-3-5-haiku-20241022` | [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys) | Direct browser-access enabled API calls |
| **Custom OpenAI-Compatible**| Custom | Provider-specific | Compatible with vLLM, LM Studio, Together, Perplexity |

### 🔄 Auto (Fallback) Mode
When **Auto (fallback)** is selected, FormattingBuddy monitors API responses. If a provider hits an HTTP `429` (rate limit/quota) or `5xx` (server outage), it automatically switches to the next configured provider, preserving the chunk progress and notifying the user.

---

## 📊 Visual Enrichments

### 1. Mermaid Flowcharts & Diagrams
- Transforms workflows, sequence interactions, hierarchies, and pipelines into Mermaid diagrams.
- Syntax validated with `mermaid.parse()`.
- If an LLM outputs malformed syntax, the app sends the exact error back to the model for automated repair (up to 2 retries).
- Live preview includes a **"Fix this block"** fallback button.

### 2. Native Data Charts (Chart.js)
- Converts numeric tables and metrics into Bar, Line, Doughnut, and Pie charts.
- Automatically inherits the app's theme palette with crisp dark/light styling and tooltips.

### 3. OpenStreetMap Geocoded Maps (Leaflet)
- Geocodes location names automatically via Nominatim OpenStreetMap API.
- Implements a strict 1-request-per-second interval queue and persistent `localStorage` cache.
- Renders interactive marker maps with Leaflet and displays warning badges for unmapped locations.

---

## 📦 Export Formats

Export your formatted document in one click from the **Download** menu:

- **📄 PDF (A4 Document)**:
  - Formatted for printing on A4 paper.
  - Page breaks strictly avoid splitting tables, callouts, or diagrams (`break-inside: avoid`).
  - Includes a Table of Contents, running header, and `"Page X of Y"` footers.
  - Converts SVG diagrams, canvas charts, and map tiles into crisp print images.
- **📝 Microsoft Word (.docx)**:
  - Real native `.docx` document (not an HTML rename).
  - True Word heading styles (`Heading 1`, `Heading 2`, `Heading 3`).
  - Formatted Word tables with styled headers.
  - Diagrams and charts captured and embedded as inline Word images.
- **🌐 Offline HTML**:
  - Standalone, self-contained single `.html` file.
  - Inlines all CSS, SVGs, and base64 chart images. Opens completely offline without any internet connection.
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

FormattingBuddy is a certified Progressive Web App that works completely offline once cached.

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
