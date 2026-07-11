import { settingsService } from '#modules/systemSettings/settings.service.js';

/** Días restantes para avisos de trial */
export const TRIAL_REMINDER_DAYS = Object.freeze([7, 3, 1]);

/** Días restantes para avisos de suscripción de pago */
export const SUBSCRIPTION_REMINDER_DAYS = Object.freeze([30, 15, 7, 3, 1]);

export const LIFECYCLE_SOURCES = Object.freeze({
  SCHEDULER: 'scheduler',
  SUPER_ADMIN: 'super_admin',
  SYSTEM: 'system',
  BILLING_WEBHOOK: 'billing_webhook',
});

export const SUBSCRIPTION_ENGINE_AUDIT = Object.freeze({
  STATUS_CHANGED: 'sa_subscription_status_changed',
  TRIAL_ENDED: 'sa_subscription_trial_ended',
  GRACE_STARTED: 'sa_subscription_grace_started',
  GRACE_ENDED: 'sa_subscription_grace_ended',
  SUSPENDED: 'sa_subscription_suspended',
  REACTIVATED: 'sa_subscription_reactivated',
  EXPIRED: 'sa_subscription_expired',
  SCHEDULER_RUN: 'sa_subscription_scheduler_run',
});

export function reminderKey(kind, days) {
  return `${kind}_${days}d`;
}

/**
 * Días restantes hasta endDate (ceil). Negativo si ya venció.
 */
export function daysUntil(date, now = new Date()) {
  const end = new Date(date).getTime();
  const start = new Date(now).getTime();
  return Math.ceil((end - start) / (24 * 60 * 60 * 1000));
}

/**
 * Umbral aplicable: el mayor N en thresholds donde daysRemaining <= N
 * y daysRemaining > siguiente umbral (o 0).
 */
export function matchingReminderThreshold(daysRemaining, thresholds) {
  const sorted = [...thresholds].sort((a, b) => b - a);
  for (let i = 0; i < sorted.length; i += 1) {
    const threshold = sorted[i];
    const next = sorted[i + 1] ?? 0;
    if (daysRemaining <= threshold && daysRemaining > next) {
      return threshold;
    }
  }
  return null;
}

export async function getGracePeriodDays() {
  const saas = await settingsService.getSaasDefaults();
  return saas.gracePeriodDays;
}
