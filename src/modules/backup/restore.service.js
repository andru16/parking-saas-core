import mongoose from 'mongoose';
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
import { backupExporterService } from './backupExporter.service.js';
import { getBackupStorageProvider } from './storage/storageRegistry.js';
import {
  BACKUP_AUDIT_ACTIONS,
  BACKUP_STATUSES,
  RESTORE_CONFIRMATION_PHRASE,
  RESTORE_STATUSES,
} from './constants.js';

/**
 * RestoreService — restauración con confirmación obligatoria (nunca automática).
 */
export class RestoreService {
  async preview(organizationId, backupId) {
    const job = await backupRepository.findByIdForOrg(backupId, organizationId);
    if (!job) throw new ApiError(404, 'Backup no encontrado');
    if (job.status !== BACKUP_STATUSES.COMPLETED) {
      throw new ApiError(400, 'Solo se pueden restaurar backups completados');
    }

    return {
      backupId: job._id,
      type: job.type,
      finishedAt: job.finishedAt,
      sizeBytes: job.sizeBytes,
      collections: job.collections,
      requiresConfirmation: true,
      confirmationPhrase: RESTORE_CONFIRMATION_PHRASE,
      warning:
        'La restauración reemplazará datos actuales de la organización con el contenido del backup. Esta acción no se ejecuta de forma automática.',
    };
  }

  /**
   * @param {{ confirm: boolean, confirmationPhrase: string }} confirmation
   */
  async restore(organizationId, backupId, confirmation, auditContext = {}) {
    if (!confirmation?.confirm) {
      throw new ApiError(400, 'Debe confirmar explícitamente la restauración');
    }
    if (confirmation.confirmationPhrase !== RESTORE_CONFIRMATION_PHRASE) {
      throw new ApiError(
        400,
        `Escriba exactamente «${RESTORE_CONFIRMATION_PHRASE}» para confirmar`,
      );
    }

    const job = await backupRepository.findByIdForOrg(backupId, organizationId);
    if (!job) throw new ApiError(404, 'Backup no encontrado');
    if (job.status !== BACKUP_STATUSES.COMPLETED || !job.storageKey) {
      throw new ApiError(400, 'El backup no está disponible para restauración');
    }

    await backupRepository.updateById(backupId, {
      'restore.status': RESTORE_STATUSES.RUNNING,
      'restore.requestedAt': new Date(),
      'restore.requestedByUserId': auditContext.userId ?? null,
      'restore.confirmedAt': new Date(),
    });

    await auditService.log({
      userId: auditContext.userId,
      organizationId,
      module: 'backup',
      action: BACKUP_AUDIT_ACTIONS.RESTORE_REQUESTED,
      description: 'Restauración confirmada e iniciada',
      entityType: 'backup_job',
      entityId: backupId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    try {
      const provider = getBackupStorageProvider(job.storageProvider);
      const buffer = await provider.get(job.storageKey);
      const payload = await backupExporterService.parseArchive(buffer);

      if (String(payload.organizationId) !== String(organizationId)) {
        throw new ApiError(400, 'El backup no pertenece a esta organización');
      }

      const summary = await this.#applyPayload(organizationId, payload);

      await backupRepository.updateById(backupId, {
        'restore.status': RESTORE_STATUSES.COMPLETED,
        'restore.finishedAt': new Date(),
        'restore.message': `Restaurados ${summary.totalDocuments} documentos en ${summary.collections} colecciones`,
      });

      await auditService.log({
        userId: auditContext.userId,
        organizationId,
        module: 'backup',
        action: BACKUP_AUDIT_ACTIONS.RESTORE_COMPLETED,
        description: 'Restauración finalizada correctamente',
        entityType: 'backup_job',
        entityId: backupId,
        metadata: summary,
      });

      await notificationService.emit(
        {
          organizationId,
          userId: null,
          category: NOTIFICATION_CATEGORIES.BACKUPS,
          type: NOTIFICATION_TYPES.SUCCESS,
          event: NOTIFICATION_EVENTS.BACKUP_RESTORE_COMPLETED,
          title: 'Restauración completada',
          message: 'Los datos del backup se restauraron correctamente.',
          priority: NOTIFICATION_PRIORITIES.HIGH,
          actionUrl: '/settings/backups',
          metadata: { backupId: String(backupId), ...summary },
        },
        { channels: ['in_app'] },
      );

      return { ok: true, summary };
    } catch (error) {
      await backupRepository.updateById(backupId, {
        'restore.status': RESTORE_STATUSES.FAILED,
        'restore.finishedAt': new Date(),
        'restore.message': error.message?.slice(0, 500) || 'Error en restauración',
      });

      await auditService.log({
        userId: auditContext.userId,
        organizationId,
        module: 'backup',
        action: BACKUP_AUDIT_ACTIONS.RESTORE_FAILED,
        description: `Error en restauración: ${error.message}`,
        entityType: 'backup_job',
        entityId: backupId,
      });

      try {
        await notificationService.emit(
          {
            organizationId,
            userId: null,
            category: NOTIFICATION_CATEGORIES.BACKUPS,
            type: NOTIFICATION_TYPES.ERROR,
            event: NOTIFICATION_EVENTS.BACKUP_RESTORE_FAILED,
            title: 'Restauración fallida',
            message: error.message || 'No se pudo restaurar el backup',
            priority: NOTIFICATION_PRIORITIES.CRITICAL,
            actionUrl: '/settings/backups',
          },
          { channels: ['in_app'] },
        );
      } catch {
        /* ignore */
      }

      throw error;
    }
  }

  async #applyPayload(organizationId, payload) {
    const orgId = new mongoose.Types.ObjectId(organizationId);
    let totalDocuments = 0;
    let collections = 0;

    for (const [name, docs] of Object.entries(payload.collections || {})) {
      if (!Array.isArray(docs) || docs.length === 0) continue;
      const col = mongoose.connection.db.collection(name);

      // Reemplazo por organización: elimina docs actuales de la org e inserta los del backup
      await col.deleteMany({ organizationId: orgId });

      const prepared = docs.map((doc) => {
        const copy = { ...doc };
        copy.organizationId = orgId;
        if (copy._id) {
          try {
            copy._id = new mongoose.Types.ObjectId(String(copy._id));
          } catch {
            delete copy._id;
          }
        }
        // Nunca restaurar hashes de contraseña vacíos de forma insegura: si viene password, mantener
        return copy;
      });

      if (prepared.length) {
        await col.insertMany(prepared, { ordered: false });
        totalDocuments += prepared.length;
        collections += 1;
      }
    }

    return { totalDocuments, collections };
  }
}

export const restoreService = new RestoreService();
