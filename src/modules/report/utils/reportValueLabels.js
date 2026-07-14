/**
 * Etiquetas en español para valores de enumeración en reportes / exportaciones.
 */
export const REPORT_STATUS_LABELS = Object.freeze({
  open: 'Abierto',
  closed: 'Cerrado',
  cancelled: 'Anulado',
  active: 'Activo',
  inactive: 'Inactivo',
  expired: 'Vencido',
  completed: 'Completado',
  refunded: 'Reembolsado',
  pending_verification: 'Pendiente de verificación',
});

export const REPORT_PAYMENT_LABELS = Object.freeze({
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  other: 'Otros',
  membership: 'Membresía',
});

export const REPORT_KIND_LABELS = Object.freeze({
  charge: 'Cobro',
  reversal: 'Reverso',
});

export const REPORT_MEMBER_TYPE_LABELS = Object.freeze({
  person: 'Persona',
  company: 'Empresa',
});

const ALL_VALUE_LABELS = Object.freeze({
  ...REPORT_STATUS_LABELS,
  ...REPORT_PAYMENT_LABELS,
  ...REPORT_KIND_LABELS,
  ...REPORT_MEMBER_TYPE_LABELS,
});

const LOCALIZED_KEYS = new Set(['status', 'method', 'kind', 'memberType', 'paymentMethod']);

export function localizeReportValue(key, value) {
  if (typeof value !== 'string') return value;
  if (!LOCALIZED_KEYS.has(key)) return value;
  return ALL_VALUE_LABELS[value] ?? value;
}

export function localizeReportRows(rows = []) {
  return rows.map((row) => {
    const next = { ...row };
    for (const key of LOCALIZED_KEYS) {
      if (key in next) {
        next[key] = localizeReportValue(key, next[key]);
      }
    }
    return next;
  });
}
