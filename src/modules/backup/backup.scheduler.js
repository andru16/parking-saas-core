import cron from 'node-cron';
import env from '#config/env.js';
import { backupConfigService } from './backupConfig.service.js';
import { backupService } from './backup.service.js';
import { BACKUP_TYPES } from './constants.js';

/**
 * BackupScheduler — backups automáticos diarios / semanales / mensuales.
 * Corre cada hora y dispara orgs cuya config coincide con la hora UTC.
 */
export class BackupScheduler {
  #task = null;
  #running = false;
  #lastRun = null;

  get isRunning() {
    return this.#running;
  }

  get lastRun() {
    return this.#lastRun;
  }

  start() {
    if (!env.backup.schedulerEnabled) {
      console.log('[BackupScheduler] Deshabilitado (BACKUP_SCHEDULER_ENABLED=false)');
      return { started: false };
    }

    if (this.#task) return { started: true, already: true };

    const expression = env.backup.schedulerCron;
    if (!cron.validate(expression)) {
      console.error(`[BackupScheduler] Cron inválido: ${expression}`);
      return { started: false, error: 'invalid_cron' };
    }

    this.#task = cron.schedule(expression, () => {
      this.runDue().catch((error) => {
        console.error('[BackupScheduler] Error:', error.message);
      });
    });

    console.log(`[BackupScheduler] Activo — cron "${expression}"`);
    return { started: true, cron: expression };
  }

  stop() {
    if (this.#task) {
      this.#task.stop();
      this.#task = null;
    }
  }

  async runDue({ now = new Date() } = {}) {
    if (this.#running) {
      return { skipped: true, reason: 'already_running', lastRun: this.#lastRun };
    }

    this.#running = true;
    const startedAt = new Date();
    const results = [];

    try {
      const due = await backupConfigService.listOrganizationsDue(now);

      for (const item of due) {
        try {
          const type = backupService.frequencyToType(item.config.frequency) || BACKUP_TYPES.DAILY;
          const job = await backupService.runBackup({
            organizationId: item.organizationId,
            type,
            triggeredBy: 'scheduler',
            triggeredByUserId: null,
            notes: 'Backup automático programado',
          });
          results.push({
            organizationId: String(item.organizationId),
            ok: true,
            backupId: String(job._id),
            type,
          });
        } catch (error) {
          results.push({
            organizationId: String(item.organizationId),
            ok: false,
            error: error.message,
          });
        }
      }

      this.#lastRun = {
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        due: due.length,
        results,
      };

      return this.#lastRun;
    } finally {
      this.#running = false;
    }
  }
}

export const backupScheduler = new BackupScheduler();
