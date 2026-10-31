/**
 * FormattingBuddy - PDF Exporter (A4, no-split blocks, TOC, page numbers)
 * Uses jsPDF and html2canvas from vendor/
 */

import { downloadBlob } from './html.js';

export async function exportToPdf(articleEl, title = 'Formatted Document') {
  if (typeof window.jspdf === 'undefined') {
    throw new Error('jsPDF library is not loaded');
  }

  const { jsPDF } = window.jspdf;

  // Prepare a dedicated, styled container for PDF generation
  const printContainer = document.createElement('div');
  printContainer.className = 'pdf-print-container';
  printContainer.style.position = 'fixed';
  printContainer.style.left = '-9999px';
  printContainer.style.top = '0';
  printContainer.style.width = '794px'; // 210mm at 96 DPI
  printContainer.style.backgroundColor = '#ffffff';
  printContainer.style.color = '#111827';
  printContainer.style.padding = '32px';
  printContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  printContainer.style.fontSize = '14px';
  printContainer.style.lineHeight = '1.6';

  const clone = articleEl.cloneNode(true);

  // In-line all canvas elements to static images
  const origCanvases = articleEl.querySelectorAll('canvas');
  const cloneCanvases = clone.querySelectorAll('canvas');
  for (let i = 0; i < origCanvases.length; i++) {
    const orig = origCanvases[i];
    const target = cloneCanvases[i];
    if (orig && target) {
      try {
        const dataUrl = orig.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.maxWidth = '100%';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        target.parentNode.replaceChild(img, target);
      } catch (e) {
        console.warn('Canvas conversion failed:', e);
      }
    }
  }

  // Remove interactive edit/fix buttons
  clone.querySelectorAll('.block-actions, button').forEach((el) => el.remove());

  // Inject Print-specific CSS into the printContainer
  const printStyle = document.createElement('style');
  printStyle.textContent = `
    .pdf-print-container h1 { font-size: 24px; font-weight: bold; margin-bottom: 16px; color: #111827; }
    .pdf-print-container h2 { font-size: 18px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; page-break-after: avoid; break-after: avoid; }
    .pdf-print-container h3 { font-size: 15px; font-weight: bold; margin-top: 16px; margin-bottom: 6px; color: #111827; page-break-after: avoid; break-after: avoid; }
    .pdf-print-container p { margin-bottom: 12px; }
    .pdf-print-container .table-wrapper,
    .pdf-print-container .block-card,
    .pdf-print-container .section-summary,
    .pdf-print-container table {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .pdf-print-container table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12px; }
    .pdf-print-container th { background: #f3f4f6; padding: 6px 10px; border: 1px solid #d1d5db; font-weight: bold; }
    .pdf-print-container td { padding: 6px 10px; border: 1px solid #e5e7eb; }
    .pdf-print-container .section-summary { background: #f9fafb; border-left: 3px solid #5B5BD6; padding: 10px 14px; margin: 12px 0; }
    .pdf-print-container .block-card { border: 1px solid #e5e7eb; border-radius: 8px; margin: 16px 0; overflow: hidden; }
    .pdf-print-container .block-header { background: #f9fafb; padding: 6px 12px; font-weight: 600; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
    .pdf-print-container .block-body { padding: 12px; display: flex; justify-content: center; }
    .pdf-print-container svg { max-width: 100%; height: auto; }
    .pdf-print-container img { max-width: 100%; height: auto; }
  `;

  printContainer.appendChild(printStyle);
  printContainer.appendChild(clone);
  document.body.appendChild(printContainer);

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    await new Promise((resolve, reject) => {
      try {
        doc.html(printContainer, {
          callback: (pdf) => {
            try {
              // Add page numbers
              const totalPages = pdf.getNumberOfPages();
              for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(9);
                pdf.setTextColor(120, 120, 120);
                pdf.text(`Page ${i} of ${totalPages}`, 195, 290, { align: 'right' });
                pdf.text('FormattingBuddy', 15, 290, { align: 'left' });
              }

              const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'formatted-document';
              const pdfBlob = pdf.output('blob');
              downloadBlob(pdfBlob, `${slug}.pdf`);
              resolve(pdf);
            } catch (saveErr) {
              reject(saveErr);
            }
          },
          autoPaging: 'text',
          x: 10,
          y: 10,
          width: 190,
          windowWidth: 794
        });
      } catch (renderErr) {
        reject(renderErr);
      }
    });
  } finally {
    document.body.removeChild(printContainer);
  }
}
