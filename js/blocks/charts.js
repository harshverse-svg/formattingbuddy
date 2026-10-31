/**
 * FormattingBuddy - Chart Block Renderer using Chart.js
 */

const PALETTE = [
  '#5B5BD6', // Primary Indigo
  '#818CF8', // Light Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#6366F1', // Violet
  '#3B82F6'  // Blue
];

export function renderChart(canvasEl, spec, isDark = false) {
  if (typeof window.Chart === 'undefined') {
    throw new Error('Chart.js library is not loaded');
  }

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

  // Style datasets according to current theme
  const textColor = isDark ? '#f4f5f7' : '#121316';
  const textMuted = isDark ? '#9aa1af' : '#687082';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  const styledDatasets = datasets.map((ds, idx) => {
    const baseColor = PALETTE[idx % PALETTE.length];
    const isPieOrDoughnut = type === 'pie' || type === 'doughnut';

    if (isPieOrDoughnut) {
      return {
        ...ds,
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: isDark ? '#15181e' : '#ffffff',
        borderWidth: 2
      };
    }

    return {
      ...ds,
      backgroundColor: type === 'line' ? `${baseColor}20` : baseColor,
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
          backgroundColor: isDark ? '#1c2027' : '#ffffff',
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: isDark ? '#282e39' : '#e2e4e9',
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

