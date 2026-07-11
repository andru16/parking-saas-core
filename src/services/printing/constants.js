/**
 * Constantes del Motor de Impresión.
 * Los ciclos/formatos de salida NO dependen de impresoras físicas.
 */

export const PRINT_DOCUMENT_TYPES = Object.freeze({
  TICKET_ENTRY: 'ticket_entry',
  TICKET_EXIT: 'ticket_exit',
  /** Alias legacy */
  ENTRY: 'entry',
  EXIT: 'exit',
  CASH_OPEN: 'cash_open',
  CASH_CLOSE: 'cash_close',
  CASH_AUDIT: 'cash_audit',
  MEMBERSHIP_PAYMENT: 'membership_payment',
  MEMBERSHIP_RENEWAL: 'membership_renewal',
  MEMBERSHIP_NEW: 'membership_new',
  PAYMENT_RECEIPT: 'payment_receipt',
});

export const PRINT_RESOURCE_TYPES = Object.freeze({
  TICKET: 'ticket',
  CASH_REGISTER: 'cash_register',
  MEMBERSHIP: 'membership',
  PAYMENT: 'payment',
  PREVIEW: 'preview',
});

export const PRINT_FORMATS = Object.freeze({
  HTML: 'html',
  TEXT: 'text',
  PDF: 'pdf',
  ESCPOS: 'escpos',
});

/** Canales/adapters de salida (escalabilidad). */
export const PRINT_ADAPTERS = Object.freeze({
  BROWSER: 'browser',
  ESCPOS: 'escpos',
  PDF: 'pdf',
  TEXT: 'text',
  BLUETOOTH: 'bluetooth',
  LAN: 'lan',
  USB: 'usb',
});

export const PRINT_PAPER_SIZES = Object.freeze(['58mm', '80mm', 'A4']);

export const PRINT_JOB_STATUSES = Object.freeze({
  RENDERED: 'rendered',
  PRINTED: 'printed',
  FAILED: 'failed',
  REPRINTED: 'reprinted',
});

export const PRINT_AUDIT_ACTIONS = Object.freeze({
  PRINTED: 'document_printed',
  REPRINT: 'document_reprinted',
  /** Legacy ticket reprint */
  TICKET_REPRINT: 'ticket_reprinted',
  PREVIEW: 'print_preview',
});

export const DEFAULT_PRINT_CONFIG = Object.freeze({
  showLogo: true,
  showParkingName: true,
  showAddress: true,
  showPhone: true,
  showTaxId: true,
  logoUrl: null,
  /** Overrides opcionales sobre Organization */
  businessName: '',
  businessTaxId: '',
  businessAddress: '',
  businessCity: '',
  businessPhone: '',
  header: '',
  footer: '',
  welcomeMessage: 'Bienvenido',
  farewellMessage: 'Gracias por su visita',
  lostTicketPolicy:
    'En caso de pérdida del ticket, el vehículo solo se entregará con documento de identidad y pago del valor correspondiente.',
  paperSize: '80mm',
  copies: 1,
  enableQr: true,
  enableBarcode: true,
  preferredAdapter: 'browser',
  customMessages: {
    entry: '',
    exit: '',
    receipt: '',
    cash: '',
    membership: '',
  },
});

/** Tipos válidos para preview / API. */
export const PRINTABLE_TYPES = Object.freeze([
  'entry',
  'exit',
  'ticket_entry',
  'ticket_exit',
  'cash_open',
  'cash_close',
  'cash_audit',
  'membership_payment',
  'membership_renewal',
  'membership_new',
  'payment_receipt',
  'auto',
]);

export function normalizeDocumentType(type) {
  const t = String(type || 'auto').toLowerCase();
  if (t === 'entry' || t === 'ticket_entry') return PRINT_DOCUMENT_TYPES.TICKET_ENTRY;
  if (t === 'exit' || t === 'ticket_exit') return PRINT_DOCUMENT_TYPES.TICKET_EXIT;
  if (Object.values(PRINT_DOCUMENT_TYPES).includes(t)) return t;
  return t;
}

export function typeLabel(type) {
  const map = {
    [PRINT_DOCUMENT_TYPES.TICKET_ENTRY]: 'INGRESO',
    [PRINT_DOCUMENT_TYPES.ENTRY]: 'INGRESO',
    entry: 'INGRESO',
    [PRINT_DOCUMENT_TYPES.TICKET_EXIT]: 'SALIDA',
    [PRINT_DOCUMENT_TYPES.EXIT]: 'SALIDA',
    exit: 'SALIDA',
    [PRINT_DOCUMENT_TYPES.CASH_OPEN]: 'APERTURA DE CAJA',
    [PRINT_DOCUMENT_TYPES.CASH_CLOSE]: 'CIERRE DE CAJA',
    [PRINT_DOCUMENT_TYPES.CASH_AUDIT]: 'ARQUEO DE CAJA',
    [PRINT_DOCUMENT_TYPES.MEMBERSHIP_PAYMENT]: 'PAGO MEMBRESÍA',
    [PRINT_DOCUMENT_TYPES.MEMBERSHIP_RENEWAL]: 'RENOVACIÓN MEMBRESÍA',
    [PRINT_DOCUMENT_TYPES.MEMBERSHIP_NEW]: 'NUEVA MEMBRESÍA',
    [PRINT_DOCUMENT_TYPES.PAYMENT_RECEIPT]: 'COMPROBANTE DE PAGO',
  };
  return map[type] ?? String(type).toUpperCase();
}
