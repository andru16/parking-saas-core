import { PRINT_ADAPTERS, PRINT_FORMATS } from '../constants.js';
import { renderPrintDocumentHtml, renderPrintDocumentText } from './browserHtml.adapter.js';
import { renderPrintDocumentPdf } from './pdf.adapter.js';
import { renderPrintDocumentEscPos } from './escpos.adapter.js';
import { ApiError } from '#utils/ApiError.js';

/**
 * Registry de PrinterAdapters.
 * Preparado para browser, ESC/POS, PDF, Bluetooth, LAN, USB.
 */

function stubAdapter(name, note) {
  return {
    name,
    status: 'prepared',
    formats: [],
    async render(document) {
      return {
        format: name,
        document,
        content: {
          status: 'not_implemented',
          adapter: name,
          note,
          textPreview: renderPrintDocumentText(document),
        },
        contentType: 'application/json',
      };
    },
  };
}

const adapters = {
  [PRINT_ADAPTERS.BROWSER]: {
    name: PRINT_ADAPTERS.BROWSER,
    status: 'ready',
    formats: [PRINT_FORMATS.HTML],
    async render(document) {
      return {
        format: PRINT_FORMATS.HTML,
        document,
        content: renderPrintDocumentHtml(document),
        contentType: 'text/html',
        adapter: PRINT_ADAPTERS.BROWSER,
      };
    },
  },
  [PRINT_ADAPTERS.TEXT]: {
    name: PRINT_ADAPTERS.TEXT,
    status: 'ready',
    formats: [PRINT_FORMATS.TEXT],
    async render(document) {
      return {
        format: PRINT_FORMATS.TEXT,
        document,
        content: renderPrintDocumentText(document),
        contentType: 'text/plain',
        adapter: PRINT_ADAPTERS.TEXT,
      };
    },
  },
  [PRINT_ADAPTERS.PDF]: {
    name: PRINT_ADAPTERS.PDF,
    status: 'ready',
    formats: [PRINT_FORMATS.PDF],
    async render(document) {
      const buffer = await renderPrintDocumentPdf(document);
      return {
        format: PRINT_FORMATS.PDF,
        document,
        content: buffer.toString('base64'),
        contentType: 'application/pdf',
        encoding: 'base64',
        adapter: PRINT_ADAPTERS.PDF,
      };
    },
  },
  [PRINT_ADAPTERS.ESCPOS]: {
    name: PRINT_ADAPTERS.ESCPOS,
    status: 'prepared',
    formats: [PRINT_FORMATS.ESCPOS],
    async render(document) {
      return {
        format: PRINT_FORMATS.ESCPOS,
        document,
        content: renderPrintDocumentEscPos(document),
        contentType: 'application/json',
        adapter: PRINT_ADAPTERS.ESCPOS,
      };
    },
  },
  [PRINT_ADAPTERS.BLUETOOTH]: stubAdapter(
    PRINT_ADAPTERS.BLUETOOTH,
    'Adapter Bluetooth preparado — integrar driver BLE / impresora móvil',
  ),
  [PRINT_ADAPTERS.LAN]: stubAdapter(
    PRINT_ADAPTERS.LAN,
    'Adapter Red LAN preparado — integrar socket TCP/IP a impresora de red',
  ),
  [PRINT_ADAPTERS.USB]: stubAdapter(
    PRINT_ADAPTERS.USB,
    'Adapter USB preparado — integrar driver local / WebUSB',
  ),
};

/** Mapeo format → adapter por defecto */
const FORMAT_TO_ADAPTER = Object.freeze({
  [PRINT_FORMATS.HTML]: PRINT_ADAPTERS.BROWSER,
  [PRINT_FORMATS.TEXT]: PRINT_ADAPTERS.TEXT,
  [PRINT_FORMATS.PDF]: PRINT_ADAPTERS.PDF,
  [PRINT_FORMATS.ESCPOS]: PRINT_ADAPTERS.ESCPOS,
});

export function listAdapters() {
  return Object.values(adapters).map((a) => ({
    name: a.name,
    status: a.status,
    formats: a.formats,
  }));
}

export function resolveAdapter({ format, adapter } = {}) {
  if (adapter && adapters[adapter]) return adapters[adapter];
  const byFormat = FORMAT_TO_ADAPTER[format] || PRINT_ADAPTERS.BROWSER;
  return adapters[byFormat];
}

export async function renderWithAdapter(document, { format = PRINT_FORMATS.HTML, adapter } = {}) {
  const resolved = resolveAdapter({ format, adapter });
  if (!resolved) {
    throw new ApiError(400, `Adapter de impresión no disponible: ${adapter || format}`);
  }
  return resolved.render(document);
}

export { adapters as printerAdapters };
