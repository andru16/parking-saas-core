/**
 * Catálogo del Centro de Notificaciones (in-app).
 * Canales externos (email, WhatsApp, SMS, push) se preparan sin activarse aún.
 */

export const NOTIFICATION_CHANNELS = Object.freeze([
  'in_app',
  'email',
  'whatsapp',
  'sms',
  'push',
]);

/** Tipos visuales del inbox */
export const NOTIFICATION_TYPES = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
  SYSTEM: 'system',
});

/** Prioridades del inbox */
export const NOTIFICATION_PRIORITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

/** @deprecated Usar MEDIUM — se acepta en escritura por compatibilidad */
export const LEGACY_PRIORITY_NORMAL = 'normal';

/** Categorías / origen de módulo */
export const NOTIFICATION_CATEGORIES = Object.freeze({
  AUTH: 'auth',
  ORGANIZATIONS: 'organizations',
  SUBSCRIPTIONS: 'subscriptions',
  PLANS: 'plans',
  VEHICLES: 'vehicles',
  TICKETS: 'tickets',
  PAYMENTS: 'payments',
  CASH_REGISTER: 'cash_register',
  MEMBERS: 'members',
  MEMBERSHIPS: 'memberships',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  SUPER_ADMIN: 'super_admin',
  SYSTEM: 'system',
  AUDIT: 'audit',
  BACKUPS: 'backups',
  SUPPORT: 'support',
});

/** Estado del registro in-app (independiente del delivery de canales externos) */
export const NOTIFICATION_INBOX_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

/** Estado de entrega en canales externos (prep.) */
export const NOTIFICATION_DELIVERY_STATUS = Object.freeze({
  PENDING: 'pending',
  QUEUED: 'queued',
  SENT: 'sent',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  DELIVERED: 'delivered',
});

/**
 * Eventos de dominio que pueden emitir notificaciones.
 * Los módulos importan estas constantes en lugar de strings sueltos.
 */
export const NOTIFICATION_EVENTS = Object.freeze({
  // Subscriptions
  TRIAL_EXPIRING: 'subscription.trial_expiring',
  TRIAL_ENDED: 'subscription.trial_ended',
  SUBSCRIPTION_EXPIRING: 'subscription.expiring',
  SUBSCRIPTION_ENDED: 'subscription.ended',
  GRACE_PERIOD_STARTED: 'subscription.grace_period_started',
  GRACE_PERIOD_ENDING: 'subscription.grace_period_ending',
  ORGANIZATION_SUSPENDED: 'subscription.organization_suspended',
  ORGANIZATION_REACTIVATED: 'subscription.organization_reactivated',

  // Auth
  AUTH_LOGIN_NEW_DEVICE: 'auth.login_new_device',
  AUTH_PASSWORD_CHANGED: 'auth.password_changed',

  // Generic
  SYSTEM_ANNOUNCEMENT: 'system.announcement',
  MANUAL: 'system.manual',

  // Backups
  BACKUP_COMPLETED: 'backup.completed',
  BACKUP_FAILED: 'backup.failed',
  BACKUP_RESTORE_COMPLETED: 'backup.restore_completed',
  BACKUP_RESTORE_FAILED: 'backup.restore_failed',

  // Support
  SUPPORT_TICKET_CREATED: 'support.ticket_created',
  SUPPORT_TICKET_REPLIED: 'support.ticket_replied',
  SUPPORT_TICKET_STATUS_CHANGED: 'support.ticket_status_changed',
  SUPPORT_TICKET_CLOSED: 'support.ticket_closed',
});

export function normalizePriority(priority) {
  if (priority === LEGACY_PRIORITY_NORMAL || priority === 'normal') {
    return NOTIFICATION_PRIORITIES.MEDIUM;
  }
  if (Object.values(NOTIFICATION_PRIORITIES).includes(priority)) return priority;
  return NOTIFICATION_PRIORITIES.MEDIUM;
}

/**
 * @param {number} daysRemaining
 */
export function priorityForDaysRemaining(daysRemaining) {
  if (daysRemaining <= 1) return NOTIFICATION_PRIORITIES.CRITICAL;
  if (daysRemaining <= 3) return NOTIFICATION_PRIORITIES.HIGH;
  if (daysRemaining <= 7) return NOTIFICATION_PRIORITIES.MEDIUM;
  return NOTIFICATION_PRIORITIES.LOW;
}

export function typeForPriority(priority) {
  const p = normalizePriority(priority);
  if (p === NOTIFICATION_PRIORITIES.CRITICAL) return NOTIFICATION_TYPES.ERROR;
  if (p === NOTIFICATION_PRIORITIES.HIGH) return NOTIFICATION_TYPES.WARNING;
  if (p === NOTIFICATION_PRIORITIES.LOW) return NOTIFICATION_TYPES.INFO;
  return NOTIFICATION_TYPES.INFO;
}
