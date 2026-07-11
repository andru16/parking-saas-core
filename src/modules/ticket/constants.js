/**
 * Estados y acciones del módulo de tickets (Centro de Operaciones).
 */
export const TICKET_STATUS = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
});

export const TICKET_AUDIT_ACTIONS = Object.freeze({
  OPENED: 'ticket_opened',
  CLOSED: 'ticket_closed',
  COLLECTED: 'ticket_collected',
  CANCELLED: 'ticket_cancelled',
  VEHICLE_AUTO_REGISTERED: 'vehicle_auto_registered',
  OPEN_FAILED: 'ticket_open_failed',
  COLLECT_FAILED: 'ticket_collect_failed',
});

/** Campos preparados para extensiones futuras (QR, barreras, etc.) */
export const TICKET_ENTRY_SOURCES = Object.freeze({
  MANUAL: 'manual',
  QR: 'qr',
  LPR: 'lpr',
  BARRIER: 'barrier',
});
