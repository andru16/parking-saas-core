import cron from 'node-cron';
import env from '#config/env.js';
import { auditService } from '#services/audit/audit.service.js';
import { SUPER_ADMIN_AUDIT_MODULE } from '#modules/superAdmin/permissions.catalog.js';
import { LIFECYCLE_SOURCES, SUBSCRIPTION_ENGINE_AUDIT } from './constants.js';
import { subscriptionValidator } from './subscriptionValidator.service.js';

/**
 * Orquestador diario del motor de suscripciones.
 * Pensado para cron interno (node-cron) o job externo (`npm run job:subscriptions`).
 */
export class SubscriptionScheduler {
  #task = null;
  #running = false;
  #lastRun = null;

  get isRunning() {
    return this.#running;
  }

  get lastRun() {
    return this.#lastRun;
  }

  /**
   * Arranca el cron si está habilitado en env.
   */
  start() {
    if (!env.subscription.schedulerEnabled) {
      console.log('[SubscriptionScheduler] Deshabilitado (SUBSCRIPTION_SCHEDULER_ENABLED=false)');
      return { started: false };
    }

    if (this.#task) {
      return { started: true, already: true };
    }

    const expression = env.subscription.schedulerCron;
    if (!cron.validate(expression)) {
      console.error(`[SubscriptionScheduler] Cron inválido: ${expression}`);
      return { started: false, error: 'invalid_cron' };
    }

    this.#task = cron.schedule(expression, () => {
      this.runDaily().catch((error) => {
        console.error('[SubscriptionScheduler] Error en runDaily:', error.message);
      });
    });

    console.log(`[SubscriptionScheduler] Activo — cron "${expression}"`);
    return { started: true, cron: expression };
  }

  stop() {
    if (this.#task) {
      this.#task.stop();
      this.#task = null;
    }
  }

  /**
   * Ejecución manual o por cron: valida todas las suscripciones.
   */
  async runDaily({ source = LIFECYCLE_SOURCES.SCHEDULER, actorUserId = null } = {}) {
    if (this.#running) {
      return { skipped: true, reason: 'already_running', lastRun: this.#lastRun };
    }

    this.#running = true;
    const startedAt = new Date();

    try {
      const summary = await subscriptionValidator.validateAll({
        now: startedAt,
        source,
      });

      this.#lastRun = {
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        summary,
        source,
      };

      await auditService.log({
        userId: actorUserId,
        organizationId: null,
        module: SUPER_ADMIN_AUDIT_MODULE,
        action: SUBSCRIPTION_ENGINE_AUDIT.SCHEDULER_RUN,
        description: `Motor de suscripciones: ${summary.scanned} revisadas, ${summary.reminders} avisos, ${summary.graceStarted} grace, ${summary.suspended} suspensiones`,
        metadata: { summary, source },
      });

      console.log(
        `[SubscriptionScheduler] OK scanned=${summary.scanned} reminders=${summary.reminders} grace=${summary.graceStarted} suspended=${summary.suspended} errors=${summary.errors.length}`,
      );

      return this.#lastRun;
    } finally {
      this.#running = false;
    }
  }

  getStatus() {
    return {
      enabled: env.subscription.schedulerEnabled,
      cron: env.subscription.schedulerCron,
      gracePeriodDays: env.subscription.gracePeriodDays,
      scheduled: Boolean(this.#task),
      running: this.#running,
      lastRun: this.#lastRun,
    };
  }
}

export const subscriptionScheduler = new SubscriptionScheduler();
