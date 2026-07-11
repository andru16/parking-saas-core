/**
 * Claves de los pasos del Setup Wizard.
 * Orden fijo — nuevos pasos se insertan sin modificar los existentes.
 */
export const SETUP_STEPS = Object.freeze({
  GENERAL_INFO: 'general_info',
  OPERATIONAL: 'operational',
  VEHICLE_CATEGORIES: 'vehicle_categories',
  RATES: 'rates',
  CASH_POINT: 'cash_point',
  SUMMARY: 'summary',
});

/** Pasos visibles del wizard. La caja se crea automáticamente al finalizar. */
export const SETUP_STEP_ORDER = Object.freeze([
  SETUP_STEPS.GENERAL_INFO,
  SETUP_STEPS.OPERATIONAL,
  SETUP_STEPS.VEHICLE_CATEGORIES,
  SETUP_STEPS.RATES,
  SETUP_STEPS.SUMMARY,
]);

export const SETUP_AUDIT_ACTIONS = Object.freeze({
  STEP_SAVED: 'setup_step_saved',
  COMPLETED: 'setup_completed',
});
