import { DEFAULT_BACKUP_CONFIG, BACKUP_FREQUENCIES } from './constants.js';
import { settingsService } from '#modules/systemSettings/settings.service.js';

/**
 * Lectura/escritura de configuración de backups por organización (vía SettingsService).
 */
export class BackupConfigService {
  normalize(raw = {}) {
    const frequency = Object.values(BACKUP_FREQUENCIES).includes(raw.frequency)
      ? raw.frequency
      : DEFAULT_BACKUP_CONFIG.frequency;

    return {
      enabled: Boolean(raw.enabled),
      frequency: raw.enabled === false ? BACKUP_FREQUENCIES.DISABLED : frequency,
      hour: clampInt(raw.hour, 0, 23, DEFAULT_BACKUP_CONFIG.hour),
      minute: clampInt(raw.minute, 0, 59, DEFAULT_BACKUP_CONFIG.minute),
      retentionDays: clampInt(raw.retentionDays, 1, 3650, DEFAULT_BACKUP_CONFIG.retentionDays),
      retentionCount: clampInt(raw.retentionCount, 1, 500, DEFAULT_BACKUP_CONFIG.retentionCount),
      storageProvider: raw.storageProvider || DEFAULT_BACKUP_CONFIG.storageProvider,
      includeAuditLogs: Boolean(raw.includeAuditLogs),
      notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 500) : '',
    };
  }

  async getConfig(organizationId) {
    const backups = await settingsService.getOrgBackupsConfig(organizationId);
    return this.normalize(backups ?? {});
  }

  async saveConfig(organizationId, payload) {
    const backups = this.normalize(payload);
    if (!backups.enabled) {
      backups.frequency = BACKUP_FREQUENCIES.DISABLED;
    } else if (backups.frequency === BACKUP_FREQUENCIES.DISABLED) {
      backups.frequency = BACKUP_FREQUENCIES.DAILY;
    }

    await settingsService.updateOrgSettingFields(organizationId, { backups });
    return backups;
  }

  async listOrganizationsDue(now = new Date()) {
    const Setting = (await import('#modules/setting/setting.model.js')).default;
    const settings = await Setting.find({
      'backups.enabled': true,
      'backups.frequency': { $in: ['daily', 'weekly', 'monthly'] },
    })
      .select('organizationId backups')
      .lean();

    return settings
      .map((s) => ({
        organizationId: s.organizationId,
        config: this.normalize(s.backups),
      }))
      .filter(({ config }) => this.#isDue(config, now));
  }

  #isDue(config, now) {
    if (!config.enabled) return false;
    if (now.getUTCHours() !== config.hour) return false;
    if (config.frequency === BACKUP_FREQUENCIES.DAILY) return true;
    if (config.frequency === BACKUP_FREQUENCIES.WEEKLY) {
      return now.getUTCDay() === 0;
    }
    if (config.frequency === BACKUP_FREQUENCIES.MONTHLY) {
      return now.getUTCDate() === 1;
    }
    return false;
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export const backupConfigService = new BackupConfigService();
