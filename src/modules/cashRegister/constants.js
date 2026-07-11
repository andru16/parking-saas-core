/**
 * Constantes del módulo de caja.
 */
export const CASH_REGISTER_STATUS = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
});

export const CASH_REGISTER_AUDIT_ACTIONS = Object.freeze({
  OPENED: 'cash_register_opened',
  CLOSED: 'cash_register_closed',
  CLOSE_ATTEMPT_FAILED: 'cash_register_close_attempt_failed',
});
