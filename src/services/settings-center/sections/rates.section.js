import Rate from '#modules/rate/rate.model.js';
import VehicleCategory from '#modules/vehicleCategory/vehicleCategory.model.js';
import { ApiError } from '#utils/ApiError.js';
import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';

/**
 * Motor de tarifas — arquitectura lista para reglas futuras (priority, contextType, ventanas).
 */
export class RatesSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.RATES, {
      label: 'Motor de tarifas',
      description: 'Precios y modalidades de cobro por categoría.',
    });
  }

  async get(context) {
    const [rates, categories] = await Promise.all([
      Rate.find({ organizationId: context.organizationId }).sort({ createdAt: 1 }).lean(),
      VehicleCategory.find({
        organizationId: context.organizationId,
        isDeleted: false,
        isActive: true,
      })
        .sort({ displayOrder: 1 })
        .select('_id name color')
        .lean(),
    ]);

    return {
      categories: categories.map((c) => ({
        _id: c._id.toString(),
        name: c.name,
        color: c.color,
      })),
      rates: rates.map(this.#toResponse),
    };
  }

  async save(context, payload) {
    if (!Array.isArray(payload.rates)) {
      throw new ApiError(400, 'Se requiere un arreglo de tarifas');
    }

    for (const item of payload.rates) {
      if (!item.vehicleCategoryId) {
        throw new ApiError(400, 'Cada tarifa debe tener una categoría de vehículo');
      }
      if (!item.name?.trim()) {
        throw new ApiError(400, 'Cada tarifa debe tener un nombre');
      }
      if (!item.billingMode) {
        throw new ApiError(400, 'Cada tarifa debe tener una modalidad de cobro');
      }
      await this.#assertCategoryBelongsToOrg(context.organizationId, item.vehicleCategoryId);
    }

    const keptIds = new Set();

    for (const item of payload.rates) {
      const data = {
        organizationId: context.organizationId,
        name: item.name.trim(),
        vehicleCategoryId: item.vehicleCategoryId,
        contextType: item.contextType || 'normal',
        billingMode: item.billingMode,
        value: item.value,
        baseTimeMinutes: item.baseTimeMinutes ?? 0,
        minFractionMinutes: item.minFractionMinutes ?? null,
        graceMinutes: item.graceMinutes ?? 0,
        maxDailyCharge: item.maxDailyCharge ?? null,
        fractionPrice: item.fractionPrice ?? null,
        windowStart: item.windowStart ?? null,
        windowEnd: item.windowEnd ?? null,
        priority: item.priority ?? 0,
        isDefault: item.isDefault ?? false,
        status: item.status || 'active',
        vehicleTypes: [],
      };

      if (item.id) {
        const updated = await Rate.findOneAndUpdate(
          { _id: item.id, organizationId: context.organizationId },
          { $set: data },
          { new: true },
        );

        if (updated) {
          keptIds.add(updated._id.toString());
          continue;
        }
      }

      const existingMatch = await Rate.findOne({
        organizationId: context.organizationId,
        vehicleCategoryId: item.vehicleCategoryId,
        billingMode: item.billingMode,
        contextType: data.contextType,
      });

      if (existingMatch) {
        existingMatch.set(data);
        await existingMatch.save();
        keptIds.add(existingMatch._id.toString());
      } else {
        const created = await Rate.create(data);
        keptIds.add(created._id.toString());
      }
    }

    const existing = await Rate.find({ organizationId: context.organizationId });
    for (const rate of existing) {
      if (!keptIds.has(rate._id.toString())) {
        await rate.deleteOne();
      }
    }

    return this.get(context);
  }

  async #assertCategoryBelongsToOrg(organizationId, categoryId) {
    const category = await VehicleCategory.findOne({
      _id: categoryId,
      organizationId,
      isDeleted: false,
    });

    if (!category) {
      throw new ApiError(400, 'Categoría de vehículo inválida');
    }
  }

  #toResponse(rate) {
    return {
      id: rate._id?.toString?.() ?? rate._id,
      name: rate.name,
      vehicleCategoryId: rate.vehicleCategoryId?.toString?.() ?? rate.vehicleCategoryId,
      contextType: rate.contextType,
      billingMode: rate.billingMode,
      value: rate.value,
      baseTimeMinutes: rate.baseTimeMinutes,
      minFractionMinutes: rate.minFractionMinutes,
      graceMinutes: rate.graceMinutes,
      maxDailyCharge: rate.maxDailyCharge,
      fractionPrice: rate.fractionPrice,
      windowStart: rate.windowStart,
      windowEnd: rate.windowEnd,
      priority: rate.priority,
      isDefault: rate.isDefault,
      status: rate.status,
    };
  }
}
