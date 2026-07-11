/**
 * Constantes del módulo Backups y Recuperación.
 */

export const BACKUP_TYPES = Object.freeze({
  MANUAL: 'manual',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
});

export const BACKUP_FREQUENCIES = Object.freeze({
  DISABLED: 'disabled',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
});

export const BACKUP_STATUSES = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELETED: 'deleted',
  EXPIRED: 'expired',
});

export const RESTORE_STATUSES = Object.freeze({
  NONE: 'none',
  PENDING_CONFIRMATION: 'pending_confirmation',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

export const STORAGE_PROVIDERS = Object.freeze({
  LOCAL: 'local',
  S3: 's3',
  AZURE: 'azure',
  GCS: 'gcs',
});

/** Prep. arquitectura futura */
export const BACKUP_FEATURES = Object.freeze({
  INCREMENTAL: false,
  COMPRESSION: true,
  ENCRYPTION: false,
  PARTIAL_RESTORE: false,
  VERSIONING: true,
});

export const BACKUP_AUDIT_ACTIONS = Object.freeze({
  CREATED: 'backup_created',
  COMPLETED: 'backup_completed',
  FAILED: 'backup_failed',
  DELETED: 'backup_deleted',
  DOWNLOADED: 'backup_downloaded',
  RESTORE_REQUESTED: 'backup_restore_requested',
  RESTORE_COMPLETED: 'backup_restore_completed',
  RESTORE_FAILED: 'backup_restore_failed',
  CONFIG_UPDATED: 'backup_config_updated',
});

export const DEFAULT_BACKUP_CONFIG = Object.freeze({
  enabled: false,
  frequency: BACKUP_FREQUENCIES.DAILY,
  hour: 3,
  minute: 0,
  retentionDays: 30,
  retentionCount: 14,
  storageProvider: STORAGE_PROVIDERS.LOCAL,
  includeAuditLogs: false,
  notes: '',
});

/**
 * Colecciones multi-tenant incluidas en el respaldo lógico.
 * Clave = nombre de colección MongoDB.
 */
export const BACKUP_COLLECTIONS = Object.freeze([
  { name: 'settings', orgField: 'organizationId' },
  { name: 'users', orgField: 'organizationId', excludeFields: ['password'] },
  { name: 'organizationroles', orgField: 'organizationId' },
  { name: 'vehiclecategories', orgField: 'organizationId' },
  { name: 'rates', orgField: 'organizationId' },
  { name: 'cashpoints', orgField: 'organizationId' },
  { name: 'vehicles', orgField: 'organizationId' },
  { name: 'members', orgField: 'organizationId' },
  { name: 'parkingmemberships', orgField: 'organizationId' },
  { name: 'tickets', orgField: 'organizationId' },
  { name: 'payments', orgField: 'organizationId' },
  { name: 'cashregisters', orgField: 'organizationId' },
  { name: 'printjobs', orgField: 'organizationId' },
  { name: 'notifications', orgField: 'organizationId' },
]);

export const RESTORE_CONFIRMATION_PHRASE = 'RESTAURAR';

export const BACKUP_FORMAT_VERSION = 1;
