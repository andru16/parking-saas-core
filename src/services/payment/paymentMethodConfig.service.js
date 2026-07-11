import { ApiError } from '#utils/ApiError.js';
import { buildDefaultPaymentMethods } from './paymentMethodCatalog.service.js';
import { settingsService } from '#modules/systemSettings/settings.service.js';

/**
 * Configuración de métodos de pago por organización (vía SettingsService).
 */
export class PaymentMethodConfigService {
  async getConfiguredMethods(organizationId) {
    const methods = await this.getAllMethods(organizationId);
    return methods.filter((m) => m.enabled);
  }

  async getAllMethods(organizationId) {
    const setting = await this.#ensureSettingWithMethods(organizationId);
    const methods = setting.paymentMethods ?? [];

    return methods
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((m) => ({
        code: m.code,
        label: m.label ?? m.code,
        enabled: m.enabled ?? true,
        displayOrder: m.displayOrder ?? 0,
        isSystem: m.isSystem ?? false,
      }));
  }

  async assertMethodAllowed(organizationId, methodCode, { allowMembership = false } = {}) {
    if (allowMembership && methodCode === 'membership') {
      return { code: 'membership', label: 'Membresía' };
    }

    const enabled = await this.getConfiguredMethods(organizationId);
    const found = enabled.find((m) => m.code === methodCode);

    if (!found) {
      throw new ApiError(400, `Método de pago no habilitado: ${methodCode}`);
    }

    return found;
  }

  async updateMethods(organizationId, methods) {
    const normalized = methods.map((m, index) => ({
      code: String(m.code).trim().toLowerCase(),
      label: m.label?.trim() || m.code,
      enabled: Boolean(m.enabled),
      displayOrder: m.displayOrder ?? index + 1,
      isSystem: Boolean(m.isSystem),
    }));

    if (!normalized.some((m) => m.enabled)) {
      throw new ApiError(400, 'Debe haber al menos un método de pago activo');
    }

    await settingsService.updateOrgSettingFields(organizationId, {
      paymentMethods: normalized,
    });

    return this.getAllMethods(organizationId);
  }

  async #ensureSettingWithMethods(organizationId) {
    let setting = await settingsService.getOrgSetting(organizationId, 'paymentMethods');

    if (!setting) {
      const defaults = buildDefaultPaymentMethods();
      await settingsService.updateOrgSettingFields(organizationId, {
        paymentMethods: defaults,
      });
      return { paymentMethods: defaults };
    }

    if (!Array.isArray(setting.paymentMethods) || setting.paymentMethods.length === 0) {
      const defaults = buildDefaultPaymentMethods();
      await settingsService.updateOrgSettingFields(organizationId, {
        paymentMethods: defaults,
      });
      return { ...setting, paymentMethods: defaults };
    }

    return setting;
  }
}

export const paymentMethodConfigService = new PaymentMethodConfigService();
