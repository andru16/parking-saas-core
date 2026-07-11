import {
  PRINT_DOCUMENT_TYPES,
  PRINT_RESOURCE_TYPES,
} from '../constants.js';
import {
  buildCodes,
  buildHeader,
  buildMeta,
  createPrintDocument,
  formatDate,
  formatDateTime,
  formatMoney,
  formatTime,
  userName,
} from './documentHelpers.js';

function ticketNumber(id) {
  return `TKT-${String(id ?? '').slice(-8).toUpperCase()}`;
}

/**
 * Plantilla: ticket de ingreso.
 */
export function buildTicketEntryDocument({ ticket, configBundle, isPreview = false }) {
  const { print, locale } = configBundle;
  const number = ticketNumber(ticket._id);
  const plate = ticket.vehicleId?.plate ?? null;
  const categoryName = ticket.vehicleCategoryId?.name ?? '—';
  const rateName =
    ticket.rateSnapshot?.name ??
    ticket.rateSnapshot?.billingMode ??
    '—';

  const lines = [
    { label: 'Ticket', value: number, emphasis: true },
    { label: 'Fecha', value: formatDate(ticket.entryAt, locale) },
    { label: 'Hora', value: formatTime(ticket.entryAt, locale) },
    ...(plate ? [{ label: 'Placa', value: plate, emphasis: true }] : []),
    { label: 'Tipo de vehículo', value: categoryName },
    { label: 'Tarifa aplicada', value: rateName },
    { label: 'Operador', value: userName(ticket.entryUserId) },
  ];

  if (ticket.notes) {
    lines.push({ label: 'Observaciones', value: ticket.notes });
  }

  return createPrintDocument({
    meta: buildMeta({
      type: PRINT_DOCUMENT_TYPES.TICKET_ENTRY,
      resourceType: PRINT_RESOURCE_TYPES.TICKET,
      resourceId: ticket._id,
      documentNumber: number,
      print,
      locale,
      isPreview,
      extra: { ticketId: ticket._id, ticketNumber: number },
    }),
    header: buildHeader(configBundle),
    lines,
    codes: buildCodes(print, ticket._id, number),
    messages: {
      primary: print.welcomeMessage || print.customMessages.entry,
      secondary: print.customMessages.receipt || null,
      lostTicketPolicy: print.lostTicketPolicy || null,
    },
    footer: { text: print.footer },
  });
}

/**
 * Plantilla: ticket de salida / cobro.
 */
export function buildTicketExitDocument({
  ticket,
  payments = [],
  configBundle,
  isPreview = false,
}) {
  const { print, locale } = configBundle;
  const number = ticketNumber(ticket._id);
  const plate = ticket.vehicleId?.plate ?? null;
  const rateName =
    ticket.rateSnapshot?.name ??
    ticket.rateSnapshot?.billingMode ??
    '—';
  const discount =
    ticket.calculationBreakdown?.discount ??
    ticket.calculationBreakdown?.discountsTotal ??
    0;
  const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const change =
    ticket.calculationBreakdown?.change ??
    ticket.calculationBreakdown?.changeGiven ??
    null;
  const methods =
    payments.length > 0
      ? payments.map((p) => p.method).filter(Boolean).join(', ')
      : ticket.coveredByMembership
        ? 'Membresía'
        : '—';

  const lines = [
    { label: 'Ticket', value: number, emphasis: true },
    ...(plate ? [{ label: 'Placa', value: plate, emphasis: true }] : []),
    { label: 'Fecha ingreso', value: formatDateTime(ticket.entryAt, locale) },
    { label: 'Fecha salida', value: formatDateTime(ticket.exitAt, locale) },
    {
      label: 'Tiempo total',
      value: ticket.durationMinutes != null ? `${ticket.durationMinutes} min` : '—',
    },
    { label: 'Tarifa', value: rateName },
    {
      label: 'Descuentos',
      value: formatMoney(discount, locale.currency),
    },
    {
      label: 'Valor pagado',
      value: formatMoney(paid || ticket.total, locale.currency),
      emphasis: true,
    },
    {
      label: 'Cambio',
      value: change != null ? formatMoney(change, locale.currency) : '—',
    },
    { label: 'Cajero', value: userName(ticket.exitUserId) },
    { label: 'Método de pago', value: methods },
  ];

  return createPrintDocument({
    meta: buildMeta({
      type: PRINT_DOCUMENT_TYPES.TICKET_EXIT,
      resourceType: PRINT_RESOURCE_TYPES.TICKET,
      resourceId: ticket._id,
      documentNumber: number,
      print,
      locale,
      isPreview,
      extra: { ticketId: ticket._id, ticketNumber: number },
    }),
    header: buildHeader(configBundle),
    lines,
    codes: buildCodes(print, ticket._id, number),
    messages: {
      primary: print.farewellMessage || print.customMessages.exit,
      secondary: print.customMessages.receipt || null,
    },
    footer: { text: print.footer },
  });
}
