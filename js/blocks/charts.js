/**
 * FormattingBuddy - Chart Block Renderer using Chart.js
 */

const PALETTES = {
  light: [
    '#4F5BD5', // Primary Indigo
    '#0284C7', // Sky
    '#0D9488', // Teal
    '#D97706', // Amber
    '#E11D48', // Rose
    '#8B5CF6', // Purple
    '#3B82F6'  // Blue
  ],
  dark: [
    '#7C86F2', // Light Indigo
    '#38BDF8', // Sky
    '#2DD4BF', // Teal
    '#FBBF24', // Amber
    '#FB7185', // Rose
    '#A78BFA', // Purple
    '#60A5FA'  // Blue
  ],
  slate: [
    '#60A5FA', // Blue accent
    '#38BDF8', // Sky
    '#2DD4BF', // Teal
    '#FBBF24', // Amber
    '#FB7185', // Rose
    '#A78BFA', // Purple
    '#818CF8'  // Indigo
  ]
};

export function renderChart(canvasEl, spec, currentTheme = 'light') {
  if (typeof window.Chart === 'undefined') {
    throw new Error('Chart.js library is not loaded');
  }

  // Support boolean or string theme
  const theme = typeof currentTheme === 'string'
    ? currentTheme
    : (currentTheme ? 'dark' : 'light');

  // Parse JSON if passed as string
  let config = spec;
  if (typeof spec === 'string') {
    try {
      config = JSON.parse(spec);
    } catch {
      throw new Error('Invalid JSON format inside chart block.');
    }
  }

  const type = (config.type || 'bar').toLowerCase();
  const title = config.title || '';
  const labels = config.labels || [];
  let datasets = config.datasets || [];

  if (!Array.isArray(datasets) || datasets.length === 0) {
    if (config.data && Array.isArray(config.data)) {
      datasets = [{ label: title || 'Data', data: config.data }];
    } else {
      throw new Error('Chart must specify a valid "datasets" array or "data" array.');
    }
  }

  // Theme-specific text & grid colors (strictly no pure white or black)
  let textColor = '#1B2433';
  let textMuted = '#5B6780';
  let gridColor = 'rgba(27, 36, 51, 0.08)';
  let tooltipBg = '#F5F8FD';
  let tooltipBorder = '#D3DCEC';
  let pieBorder = '#F5F8FD';

  if (theme === 'dark') {
    textColor = '#E6EAF5';
    textMuted = '#8E9AB8';
    gridColor = 'rgba(230, 234, 245, 0.08)';
    tooltipBg = '#151B2D';
    tooltipBorder = '#25304A';
    pieBorder = '#151B2D';
  } else if (theme === 'slate') {
    textColor = '#E2E8F0';
    textMuted = '#94A3B8';
    gridColor = 'rgba(226, 232, 240, 0.08)';
    tooltipBg = '#273140';
    tooltipBorder = '#384556';
    pieBorder = '#273140';
  }

  const palette = PALETTES[theme] || PALETTES.light;

  const styledDatasets = datasets.map((ds, idx) => {
    const baseColor = palette[idx % palette.length];
    const isPieOrDoughnut = type === 'pie' || type === 'doughnut';

    if (isPieOrDoughnut) {
      return {
        ...ds,
        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
        borderColor: pieBorder,
        borderWidth: 2
      };
    }

    return {
      ...ds,
      backgroundColor: type === 'line' ? `${baseColor}24` : baseColor,
      borderColor: baseColor,
      borderWidth: 2,
      borderRadius: type === 'bar' ? 4 : 0,
      tension: type === 'line' ? 0.3 : 0,
      fill: type === 'line'
    };
  });

  const chart = new window.Chart(canvasEl, {
    type: type,
    data: {
      labels: labels,
      datasets: styledDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: !!title,
          text: title,
          color: textColor,
          font: { size: 14, weight: '600', family: 'system-ui' },
          padding: { bottom: 12 }
        },
        legend: {
          display: styledDatasets.length > 1 || type === 'pie' || type === 'doughnut',
          labels: {
            color: textMuted,
            font: { size: 12, family: 'system-ui' },
            boxWidth: 12,
            boxHeight: 12,
            borderRadius: 2
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: (type === 'pie' || type === 'doughnut') ? {} : {
        x: {
          grid: { color: gridColor },
          ticks: { color: textMuted, font: { size: 11 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textMuted, font: { size: 11 } }
        }
      }
    }
  });

  return chart;
}

