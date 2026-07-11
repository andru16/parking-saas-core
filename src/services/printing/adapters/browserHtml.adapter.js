import { typeLabel } from '../constants.js';

/**
 * Adapter HTML para impresión desde navegador (window.print).
 * Soporta 58mm / 80mm / A4 y cualquier tipo de documento canónico.
 */
export function renderPrintDocumentHtml(document) {
  const width =
    document.meta.paperSize === '58mm'
      ? '58mm'
      : document.meta.paperSize === 'A4'
        ? '210mm'
        : '80mm';

  const escape = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const headerBits = [];
  if (document.header.showLogo && document.header.logoUrl) {
    headerBits.push(
      `<div class="logo"><img src="${escape(document.header.logoUrl)}" alt="Logo" /></div>`,
    );
  }
  if (document.header.parkingName) {
    headerBits.push(`<div class="title">${escape(document.header.parkingName)}</div>`);
  }
  if (document.header.headerText) {
    headerBits.push(`<div class="muted">${escape(document.header.headerText)}</div>`);
  }
  if (document.header.address) {
    headerBits.push(`<div class="muted">${escape(document.header.address)}</div>`);
  }
  if (document.header.phone) {
    headerBits.push(`<div class="muted">Tel: ${escape(document.header.phone)}</div>`);
  }
  if (document.header.taxId) {
    headerBits.push(`<div class="muted">NIT: ${escape(document.header.taxId)}</div>`);
  }

  const badge = document.meta.typeLabel || typeLabel(document.meta.type);

  const linesHtml = (document.lines || [])
    .map(
      (line) => `
      <div class="row ${line.emphasis ? 'emphasis' : ''}">
        <span class="label">${escape(line.label)}</span>
        <span class="value">${escape(line.value)}</span>
      </div>`,
    )
    .join('');

  const codes = document.codes || { qr: { enabled: false }, barcode: { enabled: false } };
  const codesHtml = `
    <div class="codes">
      ${
        codes.qr?.enabled
          ? `<div class="code-box"><div class="code-placeholder">QR</div><div class="code-caption">${escape(codes.qr.payload)}</div></div>`
          : ''
      }
      ${
        codes.barcode?.enabled
          ? `<div class="code-box"><div class="barcode-placeholder">||||| ${escape(codes.barcode.payload)} |||||</div></div>`
          : ''
      }
    </div>`;

  const messages = document.messages || {};
  const messagesHtml = [
    messages.primary ? `<p class="msg">${escape(messages.primary)}</p>` : '',
    messages.secondary ? `<p class="msg muted">${escape(messages.secondary)}</p>` : '',
    messages.lostTicketPolicy
      ? `<p class="policy">${escape(messages.lostTicketPolicy)}</p>`
      : '',
  ].join('');

  const docNumber =
    document.meta.documentNumber || document.meta.ticketNumber || document.meta.resourceId || '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escape(badge)} ${escape(docNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Courier New", Courier, monospace;
      font-size: ${document.meta.paperSize === 'A4' ? '13px' : '12px'};
      color: #111;
      background: #fff;
    }
    .ticket {
      width: ${width};
      max-width: 100%;
      margin: 0 auto;
      padding: ${document.meta.paperSize === 'A4' ? '24px' : '8px'};
    }
    .logo img { max-width: 100%; max-height: 64px; object-fit: contain; }
    .title { font-size: 14px; font-weight: 700; text-align: center; margin-top: 4px; }
    .muted { color: #444; text-align: center; font-size: 11px; }
    .badge {
      text-align: center;
      font-weight: 700;
      letter-spacing: 0.08em;
      margin: 10px 0 8px;
      border-top: 1px dashed #333;
      border-bottom: 1px dashed #333;
      padding: 6px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 2px 0;
    }
    .row.emphasis .value { font-weight: 700; font-size: 13px; }
    .label { color: #555; }
    .value { text-align: right; word-break: break-word; }
    .codes { margin-top: 10px; text-align: center; }
    .code-box { margin: 6px 0; }
    .code-placeholder {
      display: inline-block;
      border: 1px solid #333;
      padding: 18px 22px;
      font-weight: 700;
    }
    .barcode-placeholder {
      letter-spacing: 1px;
      font-size: 14px;
      padding: 8px 0;
    }
    .code-caption { font-size: 10px; color: #666; margin-top: 4px; word-break: break-all; }
    .msg { text-align: center; margin: 8px 0 0; }
    .policy {
      margin-top: 8px;
      font-size: 10px;
      text-align: justify;
      border-top: 1px dashed #999;
      padding-top: 6px;
    }
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 10px;
      border-top: 1px dashed #333;
      padding-top: 6px;
    }
    .preview-banner {
      background: #fef3c7;
      color: #92400e;
      text-align: center;
      font-size: 10px;
      padding: 4px;
      margin-bottom: 6px;
    }
    @media print {
      body { margin: 0; }
      .preview-banner { display: none; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    ${document.meta.isPreview ? '<div class="preview-banner">VISTA PREVIA</div>' : ''}
    <div class="header">${headerBits.join('')}</div>
    <div class="badge">${escape(badge)}</div>
    <div class="body">${linesHtml}</div>
    ${codesHtml}
    <div class="messages">${messagesHtml}</div>
    ${document.footer?.text ? `<div class="footer">${escape(document.footer.text)}</div>` : ''}
  </div>
</body>
</html>`;
}

/**
 * Texto plano — base para ESC/POS / Bluetooth / LAN / USB.
 */
export function renderPrintDocumentText(document) {
  const lines = [];
  const push = (text = '') => lines.push(text);

  if (document.header?.parkingName) push(document.header.parkingName.toUpperCase());
  if (document.header?.headerText) push(document.header.headerText);
  if (document.header?.address) push(document.header.address);
  if (document.header?.phone) push(`Tel: ${document.header.phone}`);
  if (document.header?.taxId) push(`NIT: ${document.header.taxId}`);
  push('--------------------------------');
  push(document.meta.typeLabel || typeLabel(document.meta.type));
  push('--------------------------------');

  for (const line of document.lines || []) {
    push(`${line.label}: ${line.value}`);
  }

  push('--------------------------------');
  if (document.codes?.qr?.enabled) push(`QR: ${document.codes.qr.payload}`);
  if (document.codes?.barcode?.enabled) push(`BAR: ${document.codes.barcode.payload}`);
  if (document.messages?.primary) push(document.messages.primary);
  if (document.messages?.lostTicketPolicy) push(document.messages.lostTicketPolicy);
  if (document.footer?.text) push(document.footer.text);

  return lines.join('\n');
}
