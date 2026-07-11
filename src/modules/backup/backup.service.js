import env from '#config/env.js';
import { auditService } from '#services/audit/audit.service.js';
import { notificationService } from '#services/notifications/notification.service.js';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENTS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
} from '#services/notifications/notification.events.js';
import { ApiError } from '#utils/ApiError.js';
import { backupRepository } from './backup.repository.js';
import { backupConfigService } from './backupConfig.service.js';
import { backupExporterService } from './backupExporter.service.js';
import { getBackupStorageProvider } from './storage/storageRegistry.js';
import {
  BACKUP_AUDIT_ACTIONS,
  BACKUP_STATUSES,
  BACKUP_TYPES,
  BACKUP_FREQUENCIES,
} from './constants.js';

/**
 * BackupService — creación, listado, descarga, retención y notificaciones.
 */
export class BackupService {
  async getStatus(organizationId) {
    const [config, latest, counts] = await Promise.all([
      backupConfigService.getConfig(organizationId),
      backupRepository.getLatestCompleted(organizationId),
      backupRepository.countByStatus(organizationId),
    ]);

    return {
      config,
      latest: latest
        ? {
            id: latest._id,
            type: latest.type,
            status: latest.status,
            sizeBytes: latest.sizeBytes,
            finishedAt: latest.finishedAt,
            durationMs: latest.durationMs,
          }
        : null,
      counts,
      features: {
        incremental: false,
        compression: true,
        encryption: false,
        partialRestore: false,
        versioning: true,
      },
    };
  }

  async getConfig(organizationId) {
    return backupConfigService.getConfig(organizationId);
  }

  async updateConfig(organizationId, payload, auditContext = {}) {
    const config = await backupConfigService.saveConfig(organizationId, payload);

    await auditService.log({
      userId: auditContext.userId,
      organizationId,
      module: 'backup',
      action: BACKUP_AUDIT_ACTIONS.CONFIG_UPDATED,
      description: 'Configuración de backups actualizada',
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { config },
    });

    return config;
  }

  async list(organizationId, pagination) {
    return backupRepository.listByOrganization(organizationId, pagination);
  }

  async listPlatform(filters) {
    return backupRepository.listAll(filters);
  }

  async getById(organizationId, backupId) {
    const job = await backupRepository.findByIdForOrg(backupId, organizationId);
    if (!job) throw new ApiError(404, 'Backup no encontrado');
    return job;
  }

  /**
   * Ejecuta un backup manual o programado.
   */
  async runBackup({
    organizationId,
    type = BACKUP_TYPES.MANUAL,
    triggeredBy = 'user',
    triggeredByUserId = null,
    notes = '',
    auditContext = {},
  }) {
    const config = await backupConfigService.getConfig(organizationId);
    const storageProviderName = config.storageProvider || env.backup.defaultProvider;
    const provider = getBackupStorageProvider(storageProviderName);

    const job = await backupRepository.create({
      organizationId,
      type,
      status: BACKUP_STATUSES.RUNNING,
      triggeredBy,
      triggeredByUserId,
      storageProvider: storageProviderName,
      startedAt: new Date(),
      notes: notes?.slice(0, 500) || '',
      strategy: {
        mode: 'full',
        compressed: true,
        encrypted: false,
        partial: false,
      },
      expiresAt: this.#computeExpiresAt(config.retentionDays),
    });

    await auditService.log({
      userId: triggeredByUserId,
      organizationId,
      module: 'backup',
      action: BACKUP_AUDIT_ACTIONS.CREATED,
      description: `Backup ${type} iniciado`,
      entityType: 'backup_job',
      entityId: job._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    const started = Date.now();

    try {
      const exported = await backupExporterService.exportOrganization(organizationId, {
        includeAuditLogs: config.includeAuditLogs,
      });

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `org-${organizationId}-${type}-${stamp}.json.gz`;
      const storageKey = `${organizationId}/${filename}`;

      const stored = await provider.put({
        key: storageKey,
        body: exported.buffer,
        contentType: 'application/gzip',
        metadata: { checksumSha256: exported.checksumSha256 },
      });

      const finishedAt = new Date();
      const updated = await backupRepository.updateById(job._id, {
        status: BACKUP_STATUSES.COMPLETED,
        storageKey,
        filename,
        sizeBytes: stored.sizeBytes,
        checksumSha256: exported.checksumSha256,
        collections: exported.collections,
        finishedAt,
        durationMs: Date.now() - started,
        resultMessage: 'Backup completado correctamente',
        formatVersion: exported.formatVersion,
      });

      await auditService.log({
        userId: triggeredByUserId,
        organizationId,
        module: 'backup',
        action: BACKUP_AUDIT_ACTIONS.COMPLETED,
        description: 'Backup finalizado correctamente',
        entityType: 'backup_job',
        entityId: job._id,
        metadata: { sizeBytes: stored.sizeBytes, type },
      });

      await this.#notify(organizationId, {
        event: NOTIFICATION_EVENTS.BACKUP_COMPLETED,
        type: NOTIFICATION_TYPES.SUCCESS,
        title: 'Backup completado',
        message: `La copia de seguridad (${type}) finalizó correctamente.`,
        priority: NOTIFICATION_PRIORITIES.LOW,
        metadata: { backupId: String(job._id) },
      });

      await this.applyRetention(organizationId, config);

      return updated;
    } catch (error) {
      await backupRepository.updateById(job._id, {
        status: BACKUP_STATUSES.FAILED,
        finishedAt: new Date(),
        durationMs: Date.now() - started,
        errorMessage: error.message?.slice(0, 1000) || 'Error desconocido',
        resultMessage: 'Backup fallido',
      });

      await auditService.log({
        userId: triggeredByUserId,
        organizationId,
        module: 'backup',
        action: BACKUP_AUDIT_ACTIONS.FAILED,
        description: `Error en backup: ${error.message}`,
        entityType: 'backup_job',
        entityId: job._id,
      });

      await this.#notify(organizationId, {
        event: NOTIFICATION_EVENTS.BACKUP_FAILED,
        type: NOTIFICATION_TYPES.ERROR,
        title: 'Backup fallido',
        message: `No se pudo completar la copia de seguridad: ${error.message}`,
        priority: NOTIFICATION_PRIORITIES.HIGH,
        metadata: { backupId: String(job._id) },
      });

      throw error;
    }
  }

  async download(organizationId, backupId, auditContext = {}) {
    const job = await this.getById(organizationId, backupId);
    if (job.status !== BACKUP_STATUSES.COMPLETED || !job.storageKey) {
      throw new ApiError(400, 'El backup no está disponible para descarga');
    }

    const provider = getBackupStorageProvider(job.storageProvider);
    const buffer = await provider.get(job.storageKey);

    await auditService.log({
      userId: auditContext.userId,
      organizationId,
      module: 'backup',
      action: BACKUP_AUDIT_ACTIONS.DOWNLOADED,
      description: 'Descarga de backup',
      entityType: 'backup_job',
      entityId: job._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return {
      buffer,
      filename: job.filename || `backup-${backupId}.json.gz`,
      contentType: 'application/gzip',
    };
  }

  async deleteBackup(organizationId, backupId, auditContext = {}) {
    const job = await this.getById(organizationId, backupId);
    if (job.storageKey) {
      try {
        const provider = getBackupStorageProvider(job.storageProvider);
        await provider.delete(job.storageKey);
      } catch {
        // Continuar con soft-delete aunque falle el storage
      }
    }

    await backupRepository.softDelete(backupId);

    await auditService.log({
      userId: auditContext.userId,
      organizationId,
      module: 'backup',
      action: BACKUP_AUDIT_ACTIONS.DELETED,
      description: 'Backup eliminado',
      entityType: 'backup_job',
      entityId: backupId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return { deleted: true };
  }

  async applyRetention(organizationId, config) {
    const cfg = config || (await backupConfigService.getConfig(organizationId));
    const completed = await backupRepository.listCompletedForRetention(organizationId);
    const cutoff = Date.now() - cfg.retentionDays * 24 * 60 * 60 * 1000;

    const toExpire = [];
    completed.forEach((job, index) => {
      const tooOld = job.finishedAt && new Date(job.finishedAt).getTime() < cutoff;
      const overCount = index >= cfg.retentionCount;
      if (tooOld || overCount) toExpire.push(job);
    });

    for (const job of toExpire) {
      if (job.storageKey) {
        try {
          await getBackupStorageProvider(job.storageProvider).delete(job.storageKey);
        } catch {
          /* ignore */
        }
      }
      await backupRepository.updateById(job._id, {
        status: BACKUP_STATUSES.EXPIRED,
        storageKey: null,
      });
    }

    return { expired: toExpire.length };
  }

  frequencyToType(frequency) {
    if (frequency === BACKUP_FREQUENCIES.WEEKLY) return BACKUP_TYPES.WEEKLY;
    if (frequency === BACKUP_FREQUENCIES.MONTHLY) return BACKUP_TYPES.MONTHLY;
    return BACKUP_TYPES.DAILY;
  }

  #computeExpiresAt(retentionDays) {
    const d = new Date();
    d.setDate(d.getDate() + (retentionDays || 30));
    return d;
  }

  async #notify(organizationId, { event, type, title, message, priority, metadata }) {
    try {
      await notificationService.emit(
        {
          organizationId,
          userId: null,
          category: NOTIFICATION_CATEGORIES.BACKUPS,
          type,
          event,
          title,
          message,
          priority,
          actionUrl: '/settings/backups',
          metadata,
        },
        { channels: ['in_app'] },
      );
    } catch (error) {
      console.error('[BackupService] Notificación fallida:', error.message);
    }
  }
}

export const backupService = new BackupService();
