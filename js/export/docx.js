/**
 * FormattingBuddy - DOCX Exporter
 * Generates valid Microsoft Word .docx files with heading styles, real tables, and embedded images.
 * Uses window.docx (docx.iife.js from vendor/)
 */
import { downloadBlob } from './html.js';

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function svgToImageData(svgEl) {
  return new Promise((resolve, reject) => {
    try {
      const bbox = svgEl.getBoundingClientRect();
      const width = Math.max(Math.round(bbox.width) || 600, 300);
      const height = Math.max(Math.round(bbox.height) || 400, 200);

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgEl);

      // Add XML namespace if missing
      if (!svgString.includes('xmlns=')) {
        svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2; // Crisp 2x retina render
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobUrl);

        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        resolve({
          data: base64ToUint8Array(base64),
          width: Math.min(width, 550),
          height: Math.min(height, (550 * height) / width)
        });
      };

      img.onerror = (e) => {
        URL.revokeObjectURL(blobUrl);
        reject(e);
      };

      img.src = blobUrl;
    } catch (err) {
      reject(err);
    }
  });
}

function canvasToImageData(canvasEl) {
  const dataUrl = canvasEl.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const width = Math.min(canvasEl.width / 2 || 500, 550);
  const height = Math.min(canvasEl.height / 2 || 300, 350);
  return {
    data: base64ToUint8Array(base64),
    width,
    height
  };
}

export async function exportToDocx(articleEl, title = 'Formatted Document') {
  if (typeof window.docx === 'undefined') {
    throw new Error('docx library is not loaded');
  }

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    ImageRun,
    AlignmentType
  } = window.docx;

  const docChildren = [];

  // Title at the top
  docChildren.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 }
    })
  );

  // Traverse children of article
  const childNodes = Array.from(articleEl.children);

  for (const node of childNodes) {
    const tagName = node.tagName.toLowerCase();

    if (tagName === 'h1') {
      docChildren.push(
        new Paragraph({
          text: node.textContent.trim(),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 160 }
        })
      );
    } else if (tagName === 'h2') {
      docChildren.push(
        new Paragraph({
          text: node.textContent.trim(),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 120 }
        })
      );
    } else if (tagName === 'h3') {
      docChildren.push(
        new Paragraph({
          text: node.textContent.trim(),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 }
        })
      );
    } else if (tagName === 'p') {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: node.textContent.trim(),
              size: 24 // 12pt
            })
          ],
          spacing: { after: 160 }
        })
      );
    } else if (tagName === 'ul' || tagName === 'ol') {
      const lis = node.querySelectorAll('li');
      lis.forEach((li) => {
        docChildren.push(
          new Paragraph({
            text: `• ${li.textContent.trim()}`,
            indent: { left: 360 },
            spacing: { after: 80 }
          })
        );
      });
    } else if (node.classList && node.classList.contains('section-summary')) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: node.textContent.trim(),
              italics: true,
              color: '5B5BD6'
            })
          ],
          spacing: { before: 120, after: 160 }
        })
      );
    } else if (tagName === 'div' && (node.classList.contains('table-wrapper') || node.querySelector('table'))) {
      const tableEl = node.querySelector('table') || node;
      const rows = Array.from(tableEl.querySelectorAll('tr'));
      if (rows.length > 0) {
        const docRows = rows.map((tr, rIdx) => {
          const cells = Array.from(tr.querySelectorAll('th, td'));
          return new TableRow({
            children: cells.map((cell) => {
              const isHeader = rIdx === 0 || cell.tagName.toLowerCase() === 'th';
              return new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell.textContent.trim(),
                        bold: isHeader,
                        size: 20
                      })
                    ]
                  })
                ],
                shading: isHeader ? { fill: 'F3F4F6' } : undefined,
                margins: { top: 120, bottom: 120, left: 160, right: 160 }
              });
            })
          });
        });

        docChildren.push(
          new Table({
            rows: docRows,
            width: { size: 100, type: WidthType.PERCENTAGE }
          })
        );
        docChildren.push(new Paragraph({ spacing: { after: 200 } }));
      }
    } else if (node.classList && node.classList.contains('block-card')) {
      // Check if it's a diagram, chart, or map
      const svg = node.querySelector('svg');
      const canvas = node.querySelector('canvas');
      const headerTitle = node.querySelector('.block-title')?.textContent.trim() || 'Visual Block';

      docChildren.push(
        new Paragraph({
          text: headerTitle,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 80 }
        })
      );

      if (svg) {
        try {
          const imgData = await svgToImageData(svg);
          docChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: imgData.data,
                  transformation: { width: imgData.width, height: imgData.height }
                })
              ],
              spacing: { after: 200 }
            })
          );
        } catch (err) {
          console.warn('DOCX diagram capture failed:', err);
        }
      } else if (canvas) {
        try {
          const imgData = canvasToImageData(canvas);
          docChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: imgData.data,
                  transformation: { width: imgData.width, height: imgData.height }
                })
              ],
              spacing: { after: 200 }
            })
          );
        } catch (err) {
          console.warn('DOCX chart capture failed:', err);
        }
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 inch margins
          }
        },
        children: docChildren
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'formatted-document';
  downloadBlob(blob, `${slug}.docx`);
}

