# FormattingBuddy

> A minimal, modern, installable web application (PWA) that transforms long plain-text files into beautifully formatted documents with headings, tables, diagrams, charts, and maps, and exports to PDF, HTML, DOCX, Markdown, and ZIP.

Pure static site: plain HTML/CSS/JS (ES modules), zero build steps, zero framework runtime, no backend, no database. Hosted directly on GitHub Pages.

---

## ✨ Features

- **Linear / Notion Inspired Design**: Neutral grays, single `#5B5BD6` indigo accent, 12px radii, system typography, auto light/dark mode with manual toggle, and responsive desktop/mobile layouts.
- **Local Passcode & Hardware-Grade Web Crypto**:
  - First visit prompts you to create a device passcode.
  - Generates a cryptographic PBKDF2 verification hash with random salt.
  - Derives an in-memory 256-bit AES-GCM encryption key to secure all your stored API keys in `localStorage`.
  - Auto-locks after 15 minutes of inactivity with instant memory purging.
  - "Reset App" button to instantly wipe all local device keys, drafts, and caches.
- **Multi-Provider AI Engine (Stage 2)**:
  - Supports 8 providers:
    1. **Google Gemini** (`aistudio.google.com/apikey`)
    2. **Groq** (`console.groq.com/keys`)
    3. **OpenRouter** (`openrouter.ai/keys`)
    4. **Mistral AI** (`console.mistral.ai/api-keys`)
    5. **Ollama Cloud / Local** (`ollama.com/settings/keys`)
    6. **Hugging Face** (`huggingface.co/settings/tokens`)
    7. **Anthropic Claude** (`platform.claude.com/settings/keys`)
    8. **Custom OpenAI-Compatible** (custom base URL + model)
  - Key testing utility: verifies credentials, flags invalid tokens, checks rate limits, and diagnoses CORS restrictions.
  - **Auto Fallback**: Gracefully shifts to the next enabled provider if a 429 quota or 5xx server error occurs.
- **Smart Chunking & Context Pipeline (Stage 3)**:
  - Splits documents into 1,500–2,500 word sections strictly at paragraph boundaries.
  - Sequential processing with progress bar, cancellation, and resume from failed chunks.
  - Running summary and heading tracker prevents duplicate sections and maintains stylistic coherence.
  - Local draft autosave prevents data loss.
- **Rich Visual Enrichments (Stage 4)**:
  - **Mermaid Diagrams**: Visualizes workflows, timelines, and hierarchies; syntax validated with `mermaid.parse()` and auto-repaired by AI on syntax errors.
  - **Data Charts**: Rendered with Chart.js using the app's palette and theme.
  - **Interactive & Static Maps**: Location names geocoded via OpenStreetMap Nominatim (rate-limited and cached) and mapped with Leaflet.
- **Comprehensive Client-Side Export (Stage 5)**:
  - **PDF**: A4 layout, prevents awkward page breaks across tables/diagrams (`break-inside: avoid`), includes Table of Contents and page numbers.
  - **HTML**: Standalone, self-contained single file that opens completely offline with embedded CSS, SVGs, and chart images.
  - **DOCX**: Real Microsoft Word document with proper heading hierarchy, formatted tables, and inline images.
  - **Markdown & ZIP**: Clean raw `.md` file or bundled ZIP package containing markdown, HTML, and high-resolution chart assets.
- **Installable PWA (Stage 1)**:
  - Offline caching of the entire app shell and vendor libraries via Service Worker.
  - Desktop and mobile "Install app" prompt.

---

## 🔒 Security & Privacy Notice

> **Your API keys are never committed or sent to any server.**

- All API keys are entered directly by you in the site's **Settings** modal.
- Keys are encrypted client-side using Web Crypto **AES-GCM (256-bit)** with a key derived from your device passcode via **PBKDF2 (100,000 iterations)**.
- Decrypted keys exist solely in transient JavaScript memory while the workspace is unlocked.
- All AI provider requests are made directly from your browser to the provider's API.

---

## 🚀 GitHub Pages Deployment

FormattingBuddy is pre-configured for GitHub Pages without any build steps or dependencies.

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of FormattingBuddy"
   git remote add origin https://github.com/<your-username>/formattingbuddy.git
   git branch -M main
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository settings on GitHub: **Settings &rarr; Pages**.
   - Under **Build and deployment &rarr; Source**, select **GitHub Actions**.
   - The included `.github/workflows/deploy.yml` workflow will automatically deploy your site on every push to `main`.

---

## 📱 How to Install the PWA

- **Chrome / Edge / Brave (Desktop)**:
  - Click the **"Install"** button in the top navigation bar, or click the install icon in your browser address bar.
- **Safari (iOS / iPadOS)**:
  - Tap the **Share** button &rarr; tap **"Add to Home Screen"**.
- **Chrome (Android)**:
  - Tap the three-dots menu &rarr; tap **"Install app"** or **"Add to Home screen"**.

---

## 🧪 Testing with Demo Samples

The app includes 3 pre-built samples to immediately test the formatting and export pipeline without typing:

1. **Process Sample**: Continuous integration pipeline with a 12-node Mermaid workflow and verification tables.
2. **Data Heavy Sample**: Cloud infrastructure financial statistics with bar and doughnut charts.
3. **Places Sample**: European tech innovation capitals with interactive geocoded Leaflet map.

Click **Load Sample** in the top-left toolbar, choose any sample, and click **Download** to test PDF, DOCX, or HTML export!

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
