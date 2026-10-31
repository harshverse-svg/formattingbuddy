/**
 * FormattingBuddy - Mermaid Diagram Renderer
 * Validates with mermaid.parse(), handles syntax recovery & fix retries.
 */
import { providers } from '../providers.js';

let mermaidInitialized = false;

export function initMermaid(theme = 'light') {
  if (typeof window.mermaid === 'undefined') {
    console.warn('Mermaid vendor library not yet loaded.');
    return;
  }

  let vars = {};
  if (theme === 'dark') {
    vars = {
      primaryColor: '#7C86F2',
      primaryTextColor: '#E6EAF5',
      primaryBorderColor: '#25304A',
      lineColor: '#7C86F2',
      secondaryColor: '#202A44',
      tertiaryColor: '#151B2D',
      background: '#151B2D',
      mainBkg: '#1C243B',
      nodeBorder: '#7C86F2'
    };
  } else if (theme === 'slate') {
    vars = {
      primaryColor: '#60A5FA',
      primaryTextColor: '#E2E8F0',
      primaryBorderColor: '#384556',
      lineColor: '#60A5FA',
      secondaryColor: '#384556',
      tertiaryColor: '#273140',
      background: '#273140',
      mainBkg: '#303B4C',
      nodeBorder: '#60A5FA'
    };
  } else {
    // Light (Soft Blue) - never pure white or pure black
    vars = {
      primaryColor: '#4F5BD5',
      primaryTextColor: '#1B2433',
      primaryBorderColor: '#D3DCEC',
      lineColor: '#4F5BD5',
      secondaryColor: '#E2EAF5',
      tertiaryColor: '#F5F8FD',
      background: '#F5F8FD',
      mainBkg: '#F8FAFE',
      nodeBorder: '#4F5BD5'
    };
  }

  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: theme === 'light' ? 'default' : 'dark',
    themeVariables: vars
  });
  mermaidInitialized = true;
}

/**
 * Validates mermaid code using mermaid.parse()
 */
export async function validateMermaid(code) {
  if (typeof window.mermaid === 'undefined') {
    return { valid: false, error: 'Mermaid library not loaded' };
  }
  try {
    const cleanCode = code.trim();
    await window.mermaid.parse(cleanCode);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message || 'Syntax error' };
  }
}

/**
 * Render mermaid diagram SVG into container element
 */
export async function renderMermaidDiagram(id, code, containerEl) {
  if (typeof window.mermaid === 'undefined') {
    containerEl.innerHTML = `<div class="block-error-container">Mermaid library is offline.</div>`;
    return;
  }

  try {
    const cleanCode = code.trim();
    const renderId = `fb-mermaid-${id}-${Math.floor(Math.random() * 10000)}`;
    const { svg } = await window.mermaid.render(renderId, cleanCode);
    containerEl.innerHTML = svg;
  } catch (err) {
    console.warn('Failed rendering Mermaid diagram:', err);
    throw err;
  }
}

/**
 * Sends broken mermaid code to AI to fix (max 2 retries)
 */
export async function repairMermaidWithAI(brokenCode, errorMessage, providerId = 'auto') {
  const systemPrompt = `You are an expert at Mermaid.js syntax.
Your task is to fix the invalid Mermaid code so it parses cleanly.
Rules:
- Simple, standard Mermaid syntax only (e.g. flowchart TD, graph LR, sequenceDiagram, stateDiagram-v2).
- Quote all node labels containing special characters, brackets or parentheses.
- Avoid HTML tags in labels.
- Output ONLY the fixed Mermaid code inside a single \`\`\`mermaid code fence. No explanations.`;

  const userPrompt = `The following Mermaid code failed with error: "${errorMessage}"\n\n\`\`\`mermaid\n${brokenCode}\n\`\`\`\n\nPlease fix it so it parses without errors.`;

  let activeProvider = providerId;
  if (activeProvider === 'auto') {
    const enabled = providers.getEnabledProviders();
    if (enabled.length === 0) throw new Error('No AI provider available to fix block.');
    activeProvider = enabled[0];
  }

  const raw = await providers.generateCompletion(activeProvider, systemPrompt, userPrompt);
  const match = raw.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : raw.trim();
}

