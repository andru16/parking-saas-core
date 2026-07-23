import { auditService } from '#services/audit/audit.service.js';
import {
  getSettingsSection,
  listSettingsSections,
} from '#services/settings-center/settingsSections.registry.js';
import { SETTINGS_AUDIT_ACTIONS } from '#services/settings-center/constants.js';
import Subscription from '#modules/subscription/subscription.model.js';
import Plan from '#modules/plan/plan.model.js';
import { ApiError } from '#utils/ApiError.js';
import { settingsRepository } from './settings.repository.js';
import { settingsCache, SettingsCache } from './settings.cache.js';
import {
  DEFAULT_PLATFORM_SETTINGS,
  PLATFORM_AUDIT_ACTIONS,
  SECTION_FEATURE_FLAGS,
} from './constants.js';

/**
 * SettingsService — fachada única de configuración (plataforma + organización).
 * Ningún módulo de dominio debe leer Setting/PlatformSettings directamente.
 */
export class SettingsService {
  // ─── Plataforma ─────────────────────────────────────────────

  async getPlatform() {
    const cacheKey = SettingsCache.platformKey();
    const cached = settingsCache.get(cacheKey);
    if (cached) return cached;

    let doc = await settingsRepository.findPlatform();
    if (!doc) {
      doc = await settingsRepository.ensurePlatformDefaults();
      doc = doc.toObject?.() ?? doc;
    }

    const normalized = this.#normalizePlatform(doc);
    settingsCache.set(cacheKey, normalized);
    return normalized;
  }

  async updatePlatform(payload, auditContext = {}) {
    const current = await this.getPlatform();
    const next = this.#mergePlatform(current, payload);
    const saved = await settingsRepository.upsertPlatform(next);
    settingsCache.invalidate(SettingsCache.platformKey());

    await auditService.log({
      userId: auditContext.userId ?? null,
      organizationId: null,
      module: 'settings',
      action: PLATFORM_AUDIT_ACTIONS.UPDATED,
      description: 'Configuración global de plataforma actualizada',
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { keys: Object.keys(payload || {}) },
    });

    return this.#normalizePlatform(saved);
  }

  async getSaasDefaults() {
    const platform = await this.getPlatform();
    return {
      trialDays: platform.saas.defaultTrialDays,
      trialPremiumDays: platform.saas.trialPremiumDays ?? 3,
      gracePeriodDays: platform.saas.gracePeriodDays,
    };
  }

  async getSupportContact() {
    const platform = await this.getPlatform();
    return {
      email: platform.support?.email ?? DEFAULT_PLATFORM_SETTINGS.support.email,
      whatsapp: platform.support?.whatsapp ?? '',
      schedule: platform.support?.schedule ?? DEFAULT_PLATFORM_SETTINGS.support.schedule,
    };
  }

  async getSecurityPolicy() {
    const platform = await this.getPlatform();
    return platform.security;
  }

  // ─── Organización (documento Setting) ───────────────────────

  async getOrgSetting(organizationId, projection = null) {
    const cacheKey = projection
      ? `${SettingsCache.orgKey(organizationId)}:${projection}`
      : SettingsCache.orgKey(organizationId);

    if (!projection) {
      const cached = settingsCache.get(cacheKey);
      if (cached) return cached;
    }

    const doc = await settingsRepository.findOrgSetting(organizationId, projection);
    if (!projection && doc) settingsCache.set(cacheKey, doc);
    return doc;
  }

  async updateOrgSettingFields(organizationId, patch) {
    const saved = await settingsRepository.updateOrgSetting(organizationId, patch);
    this.invalidateOrg(organizationId);
    return saved;
  }

  async getOrgGraceMinutes(organizationId) {
    const setting = await this.getOrgSetting(organizationId, 'graceMinutes');
    return setting?.graceMinutes ?? 0;
  }

  async getOrgTimezone(organizationId) {
    const setting = await this.getOrgSetting(organizationId, 'timezone');
    if (setting?.timezone) return setting.timezone;
    const platform = await this.getPlatform();
    return platform.defaults.timezone;
  }

  async getOrgMaxCapacity(organizationId) {
    const setting = await this.getOrgSetting(organizationId, 'maxCapacity');
    return setting?.maxCapacity ?? null;
  }

  async getOrgPaymentMethods(organizationId) {
    const setting = await this.getOrgSetting(organizationId, 'paymentMethods');
    return setting?.paymentMethods ?? [];
  }

  async getOrgBackupsConfig(organizationId) {
    const setting = await this.getOrgSetting(organizationId, 'backups');
    return setting?.backups ?? null;
  }

  async getOrgTicketPrintConfig(organizationId) {
    const setting = await this.getOrgSetting(organizationId, 'ticket');
    return setting?.ticket ?? null;
  }

  // ─── Secciones (Settings Center) ────────────────────────────

  listSectionsMeta() {
    return listSettingsSections();
  }

  async listSectionsForOrganization(organizationId) {
    const all = listSettingsSections();
    const features = await this.getPlanFeatures(organizationId);
    return all.filter((section) => this.#isSectionAllowed(section.key, features));
  }

  async getSection(organizationId, sectionKey) {
    await this.#assertSectionFeature(organizationId, sectionKey);

    const cacheKey = SettingsCache.orgSectionKey(organizationId, sectionKey);
    const cached = settingsCache.get(cacheKey);
    if (cached) return cached;

    const section = getSettingsSection(sectionKey);
    const data = await section.get({ organizationId });
    const result = { section: section.getMeta(), data };
    settingsCache.set(cacheKey, result);
    return result;
  }

  async saveSection(organizationId, userId, sectionKey, payload, auditContext = {}) {
    await this.#assertSectionFeature(organizationId, sectionKey);

    const section = getSettingsSection(sectionKey);
    const data = await section.save({ organizationId, userId }, payload);

    this.invalidateOrg(organizationId);

    await auditService.log({
      userId,
      organizationId,
      module: 'settings',
      action: SETTINGS_AUDIT_ACTIONS.SECTION_UPDATED,
      description: `Configuración actualizada: ${section.label}`,
      ip: auditContext.ip ?? null,
      userAgent: auditContext.userAgent ?? null,
      metadata: { section: sectionKey },
    });

    return { section: section.getMeta(), data };
  }

  // ─── Feature flags ──────────────────────────────────────────

  async getPlanFeatures(organizationId) {
    const cacheKey = `features:${organizationId}`;
    const cached = settingsCache.get(cacheKey);
    if (cached) return cached;

    const sub = await Subscription.findOne({ organizationId })
      .sort({ updatedAt: -1 })
      .select('planId')
      .lean();

    if (!sub?.planId) {
      const allOn = Object.fromEntries(
        Object.values(SECTION_FEATURE_FLAGS).map((k) => [k, true]),
      );
      settingsCache.set(cacheKey, allOn);
      return allOn;
    }

    const plan = await Plan.findById(sub.planId).select('features').lean();
    const features =
      plan?.features instanceof Map
        ? Object.fromEntries(plan.features)
        : { ...(plan?.features || {}) };

    settingsCache.set(cacheKey, features);
    return features;
  }

  invalidateOrg(organizationId) {
    settingsCache.invalidatePrefix(`org:${organizationId}`);
    settingsCache.invalidate(`features:${organizationId}`);
  }

  invalidatePlatform() {
    settingsCache.invalidate(SettingsCache.platformKey());
  }

  // ─── helpers ────────────────────────────────────────────────

  #normalizePlatform(doc) {
    const d = doc?.toObject?.() ?? doc ?? {};
    return {
      branding: { ...DEFAULT_PLATFORM_SETTINGS.branding, ...d.branding },
      maintenance: { ...DEFAULT_PLATFORM_SETTINGS.maintenance, ...d.maintenance },
      security: { ...DEFAULT_PLATFORM_SETTINGS.security, ...d.security },
      saas: { ...DEFAULT_PLATFORM_SETTINGS.saas, ...d.saas },
      support: { ...DEFAULT_PLATFORM_SETTINGS.support, ...d.support },
      defaults: { ...DEFAULT_PLATFORM_SETTINGS.defaults, ...d.defaults },
      i18n: { ...DEFAULT_PLATFORM_SETTINGS.i18n, ...d.i18n },
      multiCurrency: { ...DEFAULT_PLATFORM_SETTINGS.multiCurrency, ...d.multiCurrency },
      multiSite: { ...DEFAULT_PLATFORM_SETTINGS.multiSite, ...d.multiSite },
      dynamicVariables: {
        ...DEFAULT_PLATFORM_SETTINGS.dynamicVariables,
        ...d.dynamicVariables,
      },
      updatedAt: d.updatedAt ?? null,
    };
  }

  #mergePlatform(current, payload = {}) {
    return {
      branding: { ...current.branding, ...payload.branding },
      maintenance: { ...current.maintenance, ...payload.maintenance },
      security: { ...current.security, ...payload.security },
      saas: { ...current.saas, ...payload.saas },
      support: { ...current.support, ...payload.support },
      defaults: { ...current.defaults, ...payload.defaults },
      i18n: { ...current.i18n, ...payload.i18n },
      multiCurrency: { ...current.multiCurrency, ...payload.multiCurrency },
      multiSite: { ...current.multiSite, ...payload.multiSite },
      dynamicVariables: { ...current.dynamicVariables, ...payload.dynamicVariables },
    };
  }

  #isSectionAllowed(sectionKey, features) {
    const flag = SECTION_FEATURE_FLAGS[sectionKey];
    if (!flag) return true;
    if (features[flag] === false) return false;
    return true;
  }

  async #assertSectionFeature(organizationId, sectionKey) {
    const features = await this.getPlanFeatures(organizationId);
    if (!this.#isSectionAllowed(sectionKey, features)) {
      throw new ApiError(403, 'Su plan no incluye esta configuración');
    }
  }
}

export const settingsService = new SettingsService();

/** Aliases de arquitectura */
export { SettingsService as SystemSettingsService, settingsService as systemSettingsService };
