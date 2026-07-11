import { typeLabel } from '../constants.js';

/**
 * Helpers compartidos de plantillas de impresión.
 * No generan HTML; solo construyen el documento canónico.
 */

export function formatDateTime(value, locale = {}) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('es-CO', {
    timeZone: locale.timezone || 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: locale.timeFormat === '12h',
  });
}

export function formatDate(value, locale = {}) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('es-CO', {
    timeZone: locale.timezone || 'America/Bogota',
  });
}

export function formatTime(value, locale = {}) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString('es-CO', {
    timeZone: locale.timezone || 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale.timeFormat === '12h',
  });
}

export function formatMoney(amount, currency = 'COP') {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toLocaleString('es-CO')}`;
  }
}

export function userName(user) {
  if (!user) return '—';
  if (typeof user === 'string') return user;
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—';
}

export function buildHeader(configBundle) {
  const { organization, print } = configBundle;
  return {
    showLogo: print.showLogo,
    logoUrl: print.showLogo ? print.logoUrl || organization.logoUrl : null,
    parkingName: print.showParkingName ? organization.name : null,
    address: print.showAddress ? organization.address : null,
    city: print.showAddress ? organization.city || null : null,
    phone: print.showPhone ? organization.phone : null,
    taxId: print.showTaxId ? organization.taxId : null,
    headerText: print.header || null,
  };
}

export function buildCodes(print, payload, numberLabel) {
  return {
    qr: {
      enabled: Boolean(print.enableQr),
      payload: String(payload),
      label: 'QR (estructura preparada)',
    },
    barcode: {
      enabled: Boolean(print.enableBarcode),
      payload: String(numberLabel),
      label: 'Código de barras (estructura preparada)',
    },
  };
}

export function buildMeta({
  type,
  resourceType,
  resourceId,
  documentNumber,
  print,
  locale,
  isPreview = false,
  extra = {},
}) {
  return {
    type,
    typeLabel: typeLabel(type),
    resourceType,
    resourceId: resourceId ? String(resourceId) : null,
    ticketId: extra.ticketId ? String(extra.ticketId) : null,
    ticketNumber: extra.ticketNumber ?? null,
    documentNumber: documentNumber ?? extra.ticketNumber ?? null,
    paperSize: print.paperSize,
    copies: print.copies,
    currency: locale.currency,
    generatedAt: new Date().toISOString(),
    isPreview,
    preferredAdapter: print.preferredAdapter || 'browser',
    extensions: {
      electronicInvoice: false,
      autoPrint: false,
      multiPrinter: false,
      customTemplates: true,
      bluetooth: false,
      lan: false,
      usb: false,
    },
  };
}

export function createPrintDocument({
  meta,
  header,
  lines,
  codes,
  messages,
  footer,
}) {
  return {
    meta,
    header,
    lines: lines.filter(Boolean),
    codes,
    messages: {
      primary: messages?.primary || null,
      secondary: messages?.secondary || null,
      lostTicketPolicy: messages?.lostTicketPolicy || null,
    },
    footer: { text: footer?.text || null },
  };
}
