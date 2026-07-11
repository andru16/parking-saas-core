import CashPoint from '#modules/cashPoint/cashPoint.model.js';
import { ApiError } from '#utils/ApiError.js';
import { SETUP_STEPS } from '../constants.js';
import { SetupStep } from './setupStep.js';

const DEFAULT_CASH_POINT_NAME = 'Caja principal';

/**
 * Paso de caja — ya no se muestra en el wizard.
 * Al completar el setup se asegura un punto de caja por defecto.
 */
export class CashPointStep extends SetupStep {
  constructor() {
    super(SETUP_STEPS.CASH_POINT);
  }

  async getData(context) {
    const cashPoints = await CashPoint.find({ organizationId: context.organizationId })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    return { cashPoints: cashPoints.map(this.#toResponse) };
  }

  async save(context, payload) {
    if (!Array.isArray(payload.cashPoints)) {
      throw new ApiError(400, 'Se requiere un arreglo de cajas');
    }

    const existing = await CashPoint.find({ organizationId: context.organizationId });
    const incomingIds = new Set(payload.cashPoints.filter((c) => c.id).map((c) => c.id.toString()));

    for (const point of existing) {
      if (!incomingIds.has(point._id.toString())) {
        await point.deleteOne();
      }
    }

    for (const [index, item] of payload.cashPoints.entries()) {
      const data = {
        name: item.name.trim(),
        status: item.status || 'active',
        displayOrder: item.displayOrder ?? index,
      };

      if (item.id) {
        await CashPoint.findOneAndUpdate(
          { _id: item.id, organizationId: context.organizationId },
          { $set: data },
        );
      } else {
        await CashPoint.create({
          organizationId: context.organizationId,
          ...data,
        });
      }
    }

    return this.getData(context);
  }

  async validateForCompletion(context) {
    await this.#ensureDefaultCashPoint(context.organizationId);
    return [];
  }

  async #ensureDefaultCashPoint(organizationId) {
    const existing = await CashPoint.findOne({
      organizationId,
      status: 'active',
    }).select('_id');

    if (existing) return existing;

    const [created] = await CashPoint.create([
      {
        organizationId,
        name: DEFAULT_CASH_POINT_NAME,
        status: 'active',
        displayOrder: 0,
      },
    ]);

    return created;
  }

  #toResponse(point) {
    return {
      id: point._id,
      name: point.name,
      status: point.status,
      displayOrder: point.displayOrder,
    };
  }
}
