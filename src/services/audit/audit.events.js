/**
 * Catálogo de eventos / convenciones del sistema de auditoría.
 * Los servicios de dominio usan estos códigos para no hardcodear strings.
 */
export const AUDIT_USER_TYPES = Object.freeze({
  PLATFORM_USER: 'platform_user',
  ORGANIZATION_USER: 'organization_user',
  SYSTEM: 'system',
});

export const AUDIT_RESULTS = Object.freeze({
  SUCCESS: 'success',
  ERROR: 'error',
});

/** Módulos canónicos (lowercase en BD). */
export const AUDIT_MODULES = Object.freeze({
  AUTH: 'auth',
  ORGANIZATIONS: 'organizations',
  USERS: 'users',
  ROLES: 'roles',
  VEHICLES: 'vehicles',
  TICKET: 'ticket',
  CASH_REGISTER: 'cash_register',
  PAYMENT: 'payment',
  SETTINGS: 'settings',
  SETUP: 'setup',
  REPORT: 'report',
  BACKUP: 'backup',
  SUPPORT: 'support',
  PRINTING: 'printing',
  PLANS: 'plans',
  SUBSCRIPTIONS: 'subscriptions',
  SUPER_ADMIN: 'superadmin',
  AUDIT: 'audit',
  SYSTEM: 'system',
});

/**
 * Acciones tipadas (referencia). Los servicios pueden usar strings libres
 * siempre que respeten lowercase y max length del modelo.
 */
export const AUDIT_ACTIONS = Object.freeze({
  // Auth
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  REFRESH: 'refresh_token',

  // Organizations
  ORG_CREATE: 'create',
  ORG_UPDATE: 'update',
  ORG_SUSPEND: 'suspend',
  ORG_REACTIVATE: 'reactivate',

  // Users
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DEACTIVATED: 'user_deactivated',
  USER_PASSWORD_CHANGED: 'user_password_changed',
  USER_ROLE_CHANGED: 'user_role_changed',

  // Vehicles
  VEHICLE_CREATED: 'vehicle_created',
  VEHICLE_UPDATED: 'vehicle_updated',

  // Tickets
  TICKET_OPENED: 'ticket_opened',
  TICKET_CLOSED: 'ticket_closed',
  TICKET_CANCELLED: 'ticket_cancelled',

  // Cash
  CASH_OPENED: 'cash_register_opened',
  CASH_CLOSED: 'cash_register_closed',
  CASH_ADJUSTED: 'cash_register_adjusted',

  // Payments
  PAYMENT_CREATED: 'payment_created',
  PAYMENT_REVERSED: 'payment_reversed',

  // Settings
  SETTINGS_UPDATED: 'settings_section_updated',

  // Plans / subscriptions
  PLAN_CREATED: 'sa_plan_created',
  PLAN_UPDATED: 'sa_plan_updated',
  PLAN_DEACTIVATED: 'sa_plan_deactivated',
  SUBSCRIPTION_STATUS_CHANGED: 'sa_subscription_status_changed',
  SUBSCRIPTION_RENEWED: 'sa_subscription_renewed',
  SUBSCRIPTION_EXPIRED: 'sa_subscription_expired',

  // Audit viewer
  AUDIT_VIEWED: 'audit_viewed',
  AUDIT_EXPORTED: 'audit_exported',
});

export const AUDIT_ENTITY_TYPES = Object.freeze({
  ORGANIZATION: 'organization',
  USER: 'user',
  ROLE: 'organization_role',
  VEHICLE: 'vehicle',
  TICKET: 'ticket',
  CASH_REGISTER: 'cash_register',
  PAYMENT: 'payment',
  PLAN: 'plan',
  SUBSCRIPTION: 'subscription',
  SETTINGS_SECTION: 'settings_section',
  AUDIT_LOG: 'audit_log',
});

/** Prep. integración futura Elasticsearch / OpenSearch / SIEM */
export const AUDIT_SINK_TARGETS = Object.freeze([
  'mongodb',
  'elasticsearch',
  'opensearch',
  'siem',
]);

export function inferResultFromAction(action, explicitResult) {
  if (explicitResult) return explicitResult;
  const a = String(action || '').toLowerCase();
  if (a.includes('fail') || a.includes('error') || a.endsWith('_denied')) {
    return AUDIT_RESULTS.ERROR;
  }
  return AUDIT_RESULTS.SUCCESS;
}

export function inferUserType({ userType, userId, organizationId, module }) {
  if (userType) return userType;
  if (!userId) return AUDIT_USER_TYPES.SYSTEM;
  const mod = String(module || '').toLowerCase();
  if (mod === AUDIT_MODULES.SUPER_ADMIN || organizationId == null) {
    return AUDIT_USER_TYPES.PLATFORM_USER;
  }
  return AUDIT_USER_TYPES.ORGANIZATION_USER;
}
