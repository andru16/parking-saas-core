import Setting from '#modules/setting/setting.model.js';
import PlatformSettings from './platformSettings.model.js';
import { DEFAULT_PLATFORM_SETTINGS, PLATFORM_SETTINGS_KEY } from './constants.js';
import env from '#config/env.js';

/**
 * SettingsRepository — única capa de persistencia de configuración.
 * No expone lógica de negocio; SettingsService orquesta cache + auditoría.
 */
export class SettingsRepository {
  async findOrgSetting(organizationId, projection = null) {
    const q = Setting.findOne({ organizationId });
    if (projection) q.select(projection);
    return q.lean();
  }

  async updateOrgSetting(organizationId, patch) {
    return Setting.findOneAndUpdate(
      { organizationId },
      { $set: patch, $setOnInsert: { organizationId } },
      { upsert: true, new: true },
    ).lean();
  }

  async findPlatform() {
    return PlatformSettings.findOne({ key: PLATFORM_SETTINGS_KEY }).lean();
  }

  async upsertPlatform(patch) {
    return PlatformSettings.findOneAndUpdate(
      { key: PLATFORM_SETTINGS_KEY },
      { $set: patch, $setOnInsert: { key: PLATFORM_SETTINGS_KEY } },
      { upsert: true, new: true },
    ).lean();
  }

  /**
   * Semilla inicial desde env (solo si no existe documento).
   */
  async ensurePlatformDefaults() {
    const existing = await this.findPlatform();
    if (existing) return existing;

    const doc = {
      key: PLATFORM_SETTINGS_KEY,
      branding: {
        ...DEFAULT_PLATFORM_SETTINGS.branding,
        platformName: env.app.name || DEFAULT_PLATFORM_SETTINGS.branding.platformName,
      },
      maintenance: { ...DEFAULT_PLATFORM_SETTINGS.maintenance },
      security: {
        ...DEFAULT_PLATFORM_SETTINGS.security,
        maxLoginAttempts: env.rateLimit?.login?.max ?? 10,
        loginWindowMinutes: Math.round((env.rateLimit?.login?.windowMs ?? 900000) / 60000),
      },
      saas: {
        defaultTrialDays: env.trial?.durationDays ?? 15,
        gracePeriodDays: env.subscription?.gracePeriodDays ?? 5,
      },
      defaults: { ...DEFAULT_PLATFORM_SETTINGS.defaults },
      i18n: { ...DEFAULT_PLATFORM_SETTINGS.i18n },
      multiCurrency: { ...DEFAULT_PLATFORM_SETTINGS.multiCurrency },
      multiSite: { ...DEFAULT_PLATFORM_SETTINGS.multiSite },
      dynamicVariables: { ...DEFAULT_PLATFORM_SETTINGS.dynamicVariables },
    };

    return PlatformSettings.create(doc);
  }
}

export const settingsRepository = new SettingsRepository();
