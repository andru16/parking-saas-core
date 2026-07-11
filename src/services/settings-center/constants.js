/**
 * Claves de sección del Centro de Configuración.
 * Agregar una clave aquí + registrar el servicio = nueva sección sin tocar las demás.
 */
export const SETTINGS_SECTIONS = Object.freeze({
  GENERAL: 'general',
  OPERATIONAL: 'operational',
  VEHICLE_CATEGORIES: 'vehicle_categories',
  RATES: 'rates',
  PAYMENT_METHODS: 'payment_methods',
  CASH: 'cash',
  PRINTING: 'printing',
  MEMBERSHIPS: 'memberships',
  USERS: 'users',
  INTEGRATIONS: 'integrations',
  BACKUPS: 'backups',
});

export const SETTINGS_SECTION_ORDER = Object.freeze([
  SETTINGS_SECTIONS.GENERAL,
  SETTINGS_SECTIONS.OPERATIONAL,
  SETTINGS_SECTIONS.VEHICLE_CATEGORIES,
  SETTINGS_SECTIONS.RATES,
  SETTINGS_SECTIONS.PAYMENT_METHODS,
  SETTINGS_SECTIONS.CASH,
  SETTINGS_SECTIONS.PRINTING,
  SETTINGS_SECTIONS.MEMBERSHIPS,
  SETTINGS_SECTIONS.USERS,
  SETTINGS_SECTIONS.INTEGRATIONS,
  SETTINGS_SECTIONS.BACKUPS,
]);

export const SETTINGS_AUDIT_ACTIONS = Object.freeze({
  SECTION_UPDATED: 'settings_section_updated',
});
