import PDFDocument from 'pdfkit';

export const pdfExporter = {
  contentType: 'application/pdf',
  extension: 'pdf',

  async export({ title, columnHeaders, rows }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(14).text(title, { align: 'center' });
      doc.moveDown();

      const colWidth = (doc.page.width - 80) / columnHeaders.length;

      doc.fontSize(8).font('Helvetica-Bold');
      let x = 40;
      for (const header of columnHeaders) {
        doc.text(String(header), x, doc.y, { width: colWidth, continued: false });
        x += colWidth;
      }
      doc.moveDown(0.5);

      doc.font('Helvetica');
      for (const row of rows.slice(0, 500)) {
        x = 40;
        const y = doc.y;
        for (const cell of row) {
          doc.text(String(cell ?? ''), x, y, { width: colWidth, continued: false });
          x += colWidth;
        }
        doc.moveDown(0.4);

        if (doc.y > doc.page.height - 60) {
          doc.addPage({ layout: 'landscape' });
        }
      }

      doc.end();
    });
  },
};
