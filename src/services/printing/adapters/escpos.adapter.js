import { renderPrintDocumentText } from './browserHtml.adapter.js';

/**
 * Stub ESC/POS — texto + metadata para driver térmico futuro (58/80 mm).
 */
export function renderPrintDocumentEscPos(document) {
  return {
    encoding: 'utf8',
    commands: 'text',
    paperSize: document.meta.paperSize,
    payload: renderPrintDocumentText(document),
    note: 'Adapter ESC/POS preparado — integrar driver de impresora térmica en fase posterior',
  };
}
