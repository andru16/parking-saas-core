import Setting from '#modules/setting/setting.model.js';
import { ApiError } from '#utils/ApiError.js';
import { buildDefaultPaymentMethods } from '#services/payment/paymentMethodCatalog.service.js';
import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';

/**
 * Métodos de pago por organización — configurables (activar, renombrar, ordenar, crear).
 * Si la org no tiene métodos, se siembran defaults al leer.
 */
export class PaymentMethodsSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.PAYMENT_METHODS, {
      label: 'Métodos de pago',
      description:
        'Elija qué métodos acepta su parqueadero. Solo los activos aparecen al cobrar.',
    });
  }

  async get(context) {
    const setting = await this.#getSetting(context.organizationId);
    const methods = (setting.paymentMethods ?? [])
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((m, index) => ({
        code: m.code,
        label: m.label,
        enabled: m.enabled ?? true,
        displayOrder: m.displayOrder ?? index,
        isSystem: m.isSystem ?? false,
      }));

    return { methods };
  }

  async save(context, payload) {
    if (!Array.isArray(payload.methods)) {
      throw new ApiError(400, 'Se requiere un arreglo de métodos de pago');
    }

    const codes = new Set();
    const normalized = payload.methods.map((m, index) => {
      const code = String(m.code ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

      if (!code) {
        throw new ApiError(400, 'Cada método debe tener un código');
      }
      if (!m.label?.trim()) {
        throw new ApiError(400, 'Cada método debe tener una etiqueta');
      }
      if (codes.has(code)) {
        throw new ApiError(400, `Código de método duplicado: ${code}`);
      }
      codes.add(code);

      return {
        code,
        label: m.label.trim(),
        enabled: Boolean(m.enabled),
        displayOrder: m.displayOrder ?? index,
        isSystem: Boolean(m.isSystem),
      };
    });

    if (!normalized.some((m) => m.enabled)) {
      throw new ApiError(400, 'Debe haber al menos un método de pago activo');
    }

    await Setting.findOneAndUpdate(
      { organizationId: context.organizationId },
      {
        $set: { paymentMethods: normalized },
        $setOnInsert: { organizationId: context.organizationId },
      },
      { upsert: true },
    );

    return this.get(context);
  }

  async #getSetting(organizationId) {
    let setting = await Setting.findOne({ organizationId });
    if (!setting) {
      setting = await Setting.create({
        organizationId,
        paymentMethods: buildDefaultPaymentMethods(),
      });
      return setting;
    }

    if (!Array.isArray(setting.paymentMethods) || setting.paymentMethods.length === 0) {
      setting.paymentMethods = buildDefaultPaymentMethods();
      await setting.save();
    }

    return setting;
  }
}
