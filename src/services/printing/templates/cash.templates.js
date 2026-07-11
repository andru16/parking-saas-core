import {
  PRINT_DOCUMENT_TYPES,
  PRINT_RESOURCE_TYPES,
} from '../constants.js';
import {
  buildCodes,
  buildHeader,
  buildMeta,
  createPrintDocument,
  formatDateTime,
  formatMoney,
  userName,
} from './documentHelpers.js';

function sessionNumber(id) {
  return `CAJA-${String(id ?? '').slice(-8).toUpperCase()}`;
}

function mapTotals(totalsByMethod, currency) {
  if (!totalsByMethod) return [];
  const entries =
    totalsByMethod instanceof Map
      ? [...totalsByMethod.entries()]
      : Object.entries(totalsByMethod);
  return entries.map(([method, amount]) => ({
    label: `  ${method}`,
    value: formatMoney(amount, currency),
  }));
}

/**
 * Plantilla: apertura de caja.
 */
export function buildCashOpenDocument({ session, configBundle, isPreview = false }) {
  const { print, locale } = configBundle;
  const number = sessionNumber(session._id);
  const cashName = session.cashPointId?.name ?? session.cashPointName ?? 'Caja';

  const lines = [
    { label: 'Sesión', value: number, emphasis: true },
    { label: 'Caja', value: cashName },
    { label: 'Apertura', value: formatDateTime(session.openedAt, locale) },
    {
      label: 'Fondo inicial',
      value: formatMoney(session.openingAmount, locale.currency),
      emphasis: true,
    },
    { label: 'Cajero', value: userName(session.userId) },
  ];

  if (session.openingNotes) {
    lines.push({ label: 'Observaciones', value: session.openingNotes });
  }

  return createPrintDocument({
    meta: buildMeta({
      type: PRINT_DOCUMENT_TYPES.CASH_OPEN,
      resourceType: PRINT_RESOURCE_TYPES.CASH_REGISTER,
      resourceId: session._id,
      documentNumber: number,
      print,
      locale,
      isPreview,
    }),
    header: buildHeader(configBundle),
    lines,
    codes: buildCodes(print, session._id, number),
    messages: {
      primary: print.customMessages.cash || 'Apertura de caja registrada',
    },
    footer: { text: print.footer },
  });
}

/**
 * Plantilla: cierre de caja.
 */
export function buildCashCloseDocument({ session, configBundle, isPreview = false }) {
  const { print, locale } = configBundle;
  const number = sessionNumber(session._id);
  const cashName = session.cashPointId?.name ?? session.cashPointName ?? 'Caja';
  const summary = session.closingSummary ?? {};

  const lines = [
    { label: 'Sesión', value: number, emphasis: true },
    { label: 'Caja', value: cashName },
    { label: 'Apertura', value: formatDateTime(session.openedAt, locale) },
    { label: 'Cierre', value: formatDateTime(session.closedAt, locale) },
    { label: 'Cajero', value: userName(session.userId) },
    {
      label: 'Fondo inicial',
      value: formatMoney(session.openingAmount, locale.currency),
    },
    {
      label: 'Total recaudado',
      value: formatMoney(summary.totalCollected ?? session.calculatedAmount, locale.currency),
      emphasis: true,
    },
    ...mapTotals(summary.totalsByMethod, locale.currency),
    {
      label: 'Efectivo contado',
      value: formatMoney(session.closingAmount, locale.currency),
    },
    {
      label: 'Diferencia',
      value: formatMoney(session.difference ?? 0, locale.currency),
    },
    { label: 'Tickets cobrados', value: String(summary.ticketsPaid ?? 0) },
    { label: 'Con membresía', value: String(summary.ticketsMembership ?? 0) },
  ];

  if (session.notes) {
    lines.push({ label: 'Observaciones', value: session.notes });
  }

  return createPrintDocument({
    meta: buildMeta({
      type: PRINT_DOCUMENT_TYPES.CASH_CLOSE,
      resourceType: PRINT_RESOURCE_TYPES.CASH_REGISTER,
      resourceId: session._id,
      documentNumber: number,
      print,
      locale,
      isPreview,
    }),
    header: buildHeader(configBundle),
    lines,
    codes: buildCodes(print, session._id, number),
    messages: {
      primary: print.customMessages.cash || 'Cierre de caja',
    },
    footer: { text: print.footer },
  });
}

/**
 * Plantilla: arqueo (resumen operativo de sesión abierta o cerrada).
 */
export function buildCashAuditDocument({
  session,
  summary = null,
  configBundle,
  isPreview = false,
}) {
  const { print, locale } = configBundle;
  const number = sessionNumber(session._id);
  const cashName = session.cashPointId?.name ?? session.cashPointName ?? 'Caja';
  const data = summary ?? session.closingSummary ?? {};

  const lines = [
    { label: 'Sesión', value: number, emphasis: true },
    { label: 'Caja', value: cashName },
    { label: 'Estado', value: session.status === 'open' ? 'Abierta' : 'Cerrada' },
    { label: 'Desde', value: formatDateTime(session.openedAt, locale) },
    { label: 'Cajero', value: userName(session.userId) },
    {
      label: 'Fondo inicial',
      value: formatMoney(session.openingAmount, locale.currency),
    },
    {
      label: 'Recaudado',
      value: formatMoney(data.totalCollected ?? 0, locale.currency),
      emphasis: true,
    },
    ...mapTotals(data.totalsByMethod, locale.currency),
    { label: 'Tickets cobrados', value: String(data.ticketsPaid ?? 0) },
    { label: 'Membresía', value: String(data.ticketsMembership ?? 0) },
    { label: 'Gratuitos', value: String(data.ticketsFree ?? 0) },
  ];

  return createPrintDocument({
    meta: buildMeta({
      type: PRINT_DOCUMENT_TYPES.CASH_AUDIT,
      resourceType: PRINT_RESOURCE_TYPES.CASH_REGISTER,
      resourceId: session._id,
      documentNumber: number,
      print,
      locale,
      isPreview,
    }),
    header: buildHeader(configBundle),
    lines,
    codes: buildCodes(print, session._id, number),
    messages: {
      primary: 'Arqueo de caja',
    },
    footer: { text: print.footer },
  });
}
