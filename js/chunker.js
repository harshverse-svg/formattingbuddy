/**
 * FormattingBuddy - Text Chunking & Sequential Pipeline
 * Splits text into 1,500-2,500 word chunks at paragraph boundaries.
 * Coordinates sequential AI conversion, running summary, TOC building,
 * and automatic provider fallback.
 */
import { providers } from './providers.js';

export function countWords(text) {
  if (!text) return 0;
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Splits plain text into chunks of 1,500 to 2,500 words at paragraph boundaries.
 */
export function chunkText(text, minWords = 1500, maxWords = 2500) {
  if (!text || !text.trim()) return [];

  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n\s*\n/);

  const chunks = [];
  let currentParagraphs = [];
  let currentWordCount = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (!p) continue;

    const pWords = countWords(p);

    // If a single paragraph is longer than maxWords, split it by sentence or lines
    if (pWords > maxWords) {
      if (currentParagraphs.length > 0) {
        chunks.push(currentParagraphs.join('\n\n'));
        currentParagraphs = [];
        currentWordCount = 0;
      }

      const sentences = p.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [p];
      let sentGroup = [];
      let sentCount = 0;

      for (const s of sentences) {
        const sWords = countWords(s);
        if (sentCount + sWords > maxWords && sentGroup.length > 0) {
          chunks.push(sentGroup.join(' '));
          sentGroup = [];
          sentCount = 0;
        }
        sentGroup.push(s.trim());
        sentCount += sWords;
      }

      if (sentGroup.length > 0) {
        chunks.push(sentGroup.join(' '));
      }
      continue;
    }

    if (currentWordCount + pWords > maxWords && currentParagraphs.length > 0) {
      chunks.push(currentParagraphs.join('\n\n'));
      currentParagraphs = [p];
      currentWordCount = pWords;
    } else {
      currentParagraphs.push(p);
      currentWordCount += pWords;
      if (currentWordCount >= minWords && i < paragraphs.length - 1) {
        // We reached min threshold and are at a clean paragraph boundary
        chunks.push(currentParagraphs.join('\n\n'));
        currentParagraphs = [];
        currentWordCount = 0;
      }
    }
  }

  if (currentParagraphs.length > 0) {
    chunks.push(currentParagraphs.join('\n\n'));
  }

  return chunks;
}

export class ConversionPipeline {
  constructor(options = {}) {
    this.text = options.text || '';
    this.docType = options.docType || 'report';
    this.language = options.language || 'English';
    this.diagramLevel = options.diagramLevel || 'balanced';
    this.providerChoice = options.provider || 'auto'; // 'auto' or providerId
    this.onProgress = options.onProgress || (() => {});
    this.onNotice = options.onNotice || (() => {});

    this.chunks = chunkText(this.text);
    this.chunkResults = new Array(this.chunks.length).fill(null);
    this.runningSummary = '';
    this.headingsList = [];
    this.abortController = null;
    this.isCancelled = false;
  }

  cancel() {
    this.isCancelled = true;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  buildSystemPrompt() {
    let diagramInstructions = '';
    if (this.diagramLevel === 'rich') {
      diagramInstructions = 'Include mermaid diagrams and charts wherever processes, metrics or relationships are described.';
    } else if (this.diagramLevel === 'minimal') {
      diagramInstructions = 'Include mermaid or chart blocks only when critical for understanding.';
    } else {
      diagramInstructions = 'Add a ```mermaid block for processes, hierarchies, timelines or relationships (simple syntax, quoted labels). Add a ```chart JSON block {type,title,labels,datasets} using only numbers from the text. Add a ```map JSON block {title,places:[{name,note}]} with place names only, no coordinates.';
    }

    return `Convert raw text into well-structured Markdown.
Keep ALL original information and never invent facts, numbers, names or places.
Document Type: ${this.docType}.
Target Language: ${this.language}.
${diagramInstructions}
Add H1/H2/H3 headings.
Turn comparable data into tables.
For charts, use valid JSON: \`\`\`chart { "type": "bar"|"line"|"pie"|"doughnut", "title": "...", "labels": [...], "datasets": [{"label": "...", "data": [...]}] } \`\`\`
For maps, use valid JSON: \`\`\`map { "title": "...", "places": [{"name": "...", "note": "..."}] } \`\`\`
Add a 2-3 line summary callout per major section using "> [!SUMMARY] ...".
Output only Markdown.`;
  }

  /**
   * Run conversion starting from startIndex (default 0 or resumed chunk)
   */
  async run(startIndex = 0) {
    if (this.chunks.length === 0) {
      throw new Error('Input text is empty.');
    }

    this.abortController = new AbortController();
    this.isCancelled = false;

    // Determine available providers list
    let availableProviders = [];
    if (this.providerChoice === 'auto') {
      availableProviders = providers.getEnabledProviders();
      if (availableProviders.length === 0) {
        throw new Error('No enabled AI providers with API keys found. Please enable at least one provider in Settings.');
      }
    } else {
      if (!providers.hasKey(this.providerChoice) && this.providerChoice !== 'custom') {
        throw new Error(`API key missing for ${this.providerChoice}. Configure it in Settings.`);
      }
      availableProviders = [this.providerChoice];
    }

    let currentProviderIndex = 0;
    const systemPrompt = this.buildSystemPrompt();

    for (let i = startIndex; i < this.chunks.length; i++) {
      if (this.isCancelled) {
        throw new Error('Conversion cancelled by user.');
      }

      this.onProgress({
        chunkIndex: i + 1,
        totalChunks: this.chunks.length,
        status: `Processing section ${i + 1} of ${this.chunks.length}...`,
        percent: Math.round(((i) / this.chunks.length) * 100)
      });

      const chunk = this.chunks[i];
      let userPrompt = '';
      if (i === 0) {
        userPrompt = `Convert this first part of the document into Markdown:\n\n${chunk}`;
      } else {
        userPrompt = `Previous sections context:\n- Summary so far: ${this.runningSummary}\n- Existing Headings: ${this.headingsList.slice(-10).join(' > ')}\n\nNow convert this section into Markdown, maintaining heading hierarchy and stylistic consistency:\n\n${chunk}`;
      }

      let success = false;
      let lastError = null;

      while (!success && currentProviderIndex < availableProviders.length) {
        const currentProviderId = availableProviders[currentProviderIndex];

        try {
          const result = await providers.generateCompletion(
            currentProviderId,
            systemPrompt,
            userPrompt,
            this.abortController.signal
          );

          this.chunkResults[i] = result;
          this.extractMetadata(result);
          success = true;
        } catch (err) {
          lastError = err;
          if (this.isCancelled) throw err;

          // Check for fallback condition: 429, quota, 5xx, or network error
          const isRateLimitOrServerError =
            err.status === 429 || (err.status >= 500 && err.status <= 599) || !err.status;

          if (this.providerChoice === 'auto' && isRateLimitOrServerError && currentProviderIndex < availableProviders.length - 1) {
            const failedProviderName = providers.getSettings(currentProviderId).model || currentProviderId;
            currentProviderIndex++;
            const nextProviderName = providers.getSettings(availableProviders[currentProviderIndex]).model || availableProviders[currentProviderIndex];
            this.onNotice(`Switching provider: ${failedProviderName} encountered an error (${err.message}). Trying ${nextProviderName}...`);
          } else {
            // Cannot fallback further
            err.failedChunkIndex = i;
            throw err;
          }
        }
      }

      if (!success) {
        const err = lastError || new Error(`Failed to process section ${i + 1}.`);
        err.failedChunkIndex = i;
        throw err;
      }
    }

    this.onProgress({
      chunkIndex: this.chunks.length,
      totalChunks: this.chunks.length,
      status: 'Finalizing document formatting...',
      percent: 100
    });

    const finalMarkdown = this.mergeAndClean(this.chunkResults);
    return finalMarkdown;
  }

  extractMetadata(chunkMarkdown) {
    // Collect headings
    const headingMatches = chunkMarkdown.match(/^(#{1,3})\s+(.+)$/gm);
    if (headingMatches) {
      for (const h of headingMatches) {
        this.headingsList.push(h.replace(/^#+\s*/, '').trim());
      }
    }

    // Keep brief running summary (approx 200 words)
    const summaryMatch = chunkMarkdown.match(/>\s*\[!SUMMARY\]\s*([^>\n]+)/i);
    if (summaryMatch) {
      this.runningSummary += ' ' + summaryMatch[1].trim();
    } else {
      const firstPara = chunkMarkdown.split('\n\n').find((p) => !p.startsWith('#') && p.trim().length > 30);
      if (firstPara) {
        this.runningSummary += ' ' + firstPara.slice(0, 150).trim();
      }
    }
    // Limit summary length to 500 chars
    if (this.runningSummary.length > 500) {
      this.runningSummary = this.runningSummary.slice(-500);
    }
  }

  /**
   * Merges all converted chunk markdowns, removes duplicate adjacent headings,
   * ensures single H1 title, and builds an accurate Table of Contents.
   */
  mergeAndClean(results) {
    let combined = results.filter(Boolean).join('\n\n');

    // Remove repeated identical headings that occur consecutively
    const lines = combined.split('\n');
    const cleanedLines = [];
    let lastHeading = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const title = headingMatch[2].trim().toLowerCase();
        if (title === lastHeading) {
          // Skip duplicate heading
          continue;
        }
        lastHeading = title;
      } else if (line.trim().length > 0) {
        lastHeading = '';
      }
      cleanedLines.push(line);
    }

    return cleanedLines.join('\n');
  }
}

