/**
 * FormattingBuddy - Text Chunking & Sequential Pipeline
 * Splits text into 1,500-2,500 word chunks at heading or page boundaries with small overlaps.
 * Coordinates sequential AI conversion, running summary, TOC building,
 * chunk-level caching in IndexedDB, and automatic provider fallback.
 */
import { providers } from './providers.js';
import { getCachedChunk, setCachedChunk } from './db.js';

export function countWords(text) {
  if (!text) return 0;
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Splits document text into chunks prioritizing headings or page breaks first,
 * then 1,500 to 2,500 words with small overlaps.
 */
export function chunkText(text, minWords = 1500, maxWords = 2500, overlapWords = 50) {
  if (!text || !text.trim()) return [];

  const normalized = text.replace(/\r\n/g, '\n').replace(/\f/g, '\n\n---\n\n');

  // Step 1: Detect natural section or page boundaries:
  // e.g. "## Slide ", "## Page ", "## Sheet: ", "---", or major Markdown headings "^# " / "^## "
  const rawSections = splitByHeadingsOrPages(normalized);

  const chunks = [];
  let currentGroup = [];
  let currentWordCount = 0;
  let previousChunkTrailingWords = '';

  for (let sIdx = 0; sIdx < rawSections.length; sIdx++) {
    const section = rawSections[sIdx].trim();
    if (!section) continue;

    const sWords = countWords(section);

    // If a single section is larger than maxWords, break it down by paragraphs
    if (sWords > maxWords) {
      if (currentGroup.length > 0) {
        chunks.push(finalizeChunk(currentGroup.join('\n\n'), previousChunkTrailingWords));
        previousChunkTrailingWords = extractTrailingWords(chunks[chunks.length - 1], overlapWords);
        currentGroup = [];
        currentWordCount = 0;
      }

      const subChunks = splitLongSectionByParagraphs(section, minWords, maxWords);
      for (let k = 0; k < subChunks.length; k++) {
        chunks.push(finalizeChunk(subChunks[k], previousChunkTrailingWords));
        previousChunkTrailingWords = extractTrailingWords(chunks[chunks.length - 1], overlapWords);
      }
      continue;
    }

    if (currentWordCount + sWords > maxWords && currentGroup.length > 0) {
      chunks.push(finalizeChunk(currentGroup.join('\n\n'), previousChunkTrailingWords));
      previousChunkTrailingWords = extractTrailingWords(chunks[chunks.length - 1], overlapWords);
      currentGroup = [section];
      currentWordCount = sWords;
    } else {
      currentGroup.push(section);
      currentWordCount += sWords;

      if (currentWordCount >= minWords && sIdx < rawSections.length - 1) {
        chunks.push(finalizeChunk(currentGroup.join('\n\n'), previousChunkTrailingWords));
        previousChunkTrailingWords = extractTrailingWords(chunks[chunks.length - 1], overlapWords);
        currentGroup = [];
        currentWordCount = 0;
      }
    }
  }

  if (currentGroup.length > 0) {
    chunks.push(finalizeChunk(currentGroup.join('\n\n'), previousChunkTrailingWords));
  }

  return chunks;
}

function splitByHeadingsOrPages(text) {
  // Check if text has Markdown headings (# or ##) or slide/page dividers
  const hasHeadings = /(?:^|\n)#{1,2}\s+[^\n]+/m.test(text);
  const hasPageDividers = /(?:^|\n)(?:---|===|## Slide|## Page|## Sheet:)/m.test(text);

  if (hasHeadings || hasPageDividers) {
    // Split on heading or page boundaries while preserving the delimiter
    const parts = text.split(/(?=\n#{1,2}\s+|\n---|\n===|\n## Slide|\n## Page|\n## Sheet:)/g);
    return parts.filter(p => p.trim().length > 0);
  }

  // Fallback to paragraph splitting
  return text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
}

function splitLongSectionByParagraphs(section, minWords, maxWords) {
  const paragraphs = section.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const result = [];
  let current = [];
  let words = 0;

  for (const p of paragraphs) {
    const pCount = countWords(p);
    if (words + pCount > maxWords && current.length > 0) {
      result.push(current.join('\n\n'));
      current = [p];
      words = pCount;
    } else {
      current.push(p);
      words += pCount;
      if (words >= minWords) {
        result.push(current.join('\n\n'));
        current = [];
        words = 0;
      }
    }
  }

  if (current.length > 0) {
    result.push(current.join('\n\n'));
  }
  return result;
}

function extractTrailingWords(chunk, count) {
  if (!chunk || count <= 0) return '';
  const words = chunk.trim().split(/\s+/);
  return words.slice(-count).join(' ');
}

function finalizeChunk(chunkText, overlapPrefix) {
  const trimmed = chunkText.trim();
  if (!overlapPrefix || !overlapPrefix.trim()) return trimmed;
  // Prepend small overlap context marker for the AI to ensure seamless continuity
  return `[Context from previous section: "...${overlapPrefix.trim()}..."]\n\n${trimmed}`;
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
   * Run conversion starting from startIndex (default 0 or resumed chunk).
   * Checks IndexedDB chunk cache first by text hash so retries and switches
   * never repeat finished work.
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

      const chunk = this.chunks[i];

      // 1. Check if chunk is already cached in memory or IndexedDB
      const cachedResult = this.chunkResults[i] || (await getCachedChunk(chunk));
      if (cachedResult) {
        this.chunkResults[i] = cachedResult;
        this.extractMetadata(cachedResult);
        this.onProgress({
          chunkIndex: i + 1,
          totalChunks: this.chunks.length,
          status: `Restored cached section ${i + 1} of ${this.chunks.length}...`,
          percent: Math.round(((i + 1) / this.chunks.length) * 100)
        });
        continue;
      }

      this.onProgress({
        chunkIndex: i + 1,
        totalChunks: this.chunks.length,
        status: `Processing section ${i + 1} of ${this.chunks.length}...`,
        percent: Math.round(((i) / this.chunks.length) * 100)
      });

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

          // Cache chunk in IndexedDB by SHA-256 text hash
          const activeModel = providers.getSettings(currentProviderId).model || '';
          await setCachedChunk(chunk, result, currentProviderId, activeModel);

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
    if (!chunkMarkdown) return;

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
   * ensures single H1 title, and cleans context wrappers.
   */
  mergeAndClean(results) {
    let combined = results.filter(Boolean).join('\n\n');

    // Strip out any accidental leftover overlap context markers
    combined = combined.replace(/\[Context from previous section:[\s\S]*?\]\n\n?/g, '');

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
