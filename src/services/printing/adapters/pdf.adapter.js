import PDFDocument from 'pdfkit';
import { renderPrintDocumentText } from './browserHtml.adapter.js';

/**
 * Adapter PDF — reportes A4 y comprobantes archivables.
 */
export function renderPrintDocumentPdf(document) {
  return new Promise((resolve, reject) => {
    const isA4 = document.meta.paperSize === 'A4';
    const doc = new PDFDocument({
      size: isA4 ? 'A4' : [document.meta.paperSize === '58mm' ? 164 : 226, 600],
      margin: isA4 ? 40 : 16,
    });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const title = document.meta.typeLabel || document.meta.type || 'Comprobante';
    doc.fontSize(isA4 ? 14 : 11).text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(isA4 ? 11 : 9).text(renderPrintDocumentText(document), {
      align: 'left',
      lineGap: 2,
    });

    doc.end();
  });
}
