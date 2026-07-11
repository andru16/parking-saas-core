import Rate from '#modules/rate/rate.model.js';
import { ApiError } from '#utils/ApiError.js';

/**
 * Resuelve la tarifa aplicable para una categoría de vehículo al ingreso.
 */
export class RateResolverService {
  async resolveForCategory(organizationId, vehicleCategoryId) {
    const now = new Date();

    const rates = await Rate.find({
      organizationId,
      vehicleCategoryId,
      status: 'active',
    })
      .sort({ priority: -1, isDefault: -1, createdAt: 1 })
      .lean();

    const validRates = rates.filter((rate) => {
      if (rate.validFrom && rate.validFrom > now) return false;
      if (rate.validTo && rate.validTo < now) return false;
      return true;
    });

    if (validRates.length === 0) {
      throw new ApiError(422, 'No hay tarifa activa configurada para esta categoría de vehículo');
    }

    const normalRate = validRates.find((r) => r.contextType === 'normal');
    const selected = normalRate ?? validRates[0];

    return {
      rateId: selected._id,
      rateSnapshot: this.#buildSnapshot(selected),
    };
  }

  #buildSnapshot(rate) {
    return {
      rateId: rate._id,
      name: rate.name,
      vehicleCategoryId: rate.vehicleCategoryId,
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
      capturedAt: new Date().toISOString(),
    };
  }
}

export const rateResolverService = new RateResolverService();
