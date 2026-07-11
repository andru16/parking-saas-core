/**
 * Constantes del módulo de pagos.
 */
export const PAYMENT_STATUS = Object.freeze({
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
});

export const PAYMENT_KIND = Object.freeze({
  CHARGE: 'charge',
  REVERSAL: 'reversal',
});

export const PAYMENT_AUDIT_ACTIONS = Object.freeze({
  CREATED: 'payment_created',
  REVERSED: 'payment_reversed',
  COLLECT_FAILED: 'payment_collect_failed',
});

export const MEMBERSHIP_METHOD_CODE = 'membership';
