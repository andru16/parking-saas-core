import CashPoint from '#modules/cashPoint/cashPoint.model.js';
import Setting from '#modules/setting/setting.model.js';
import { ApiError } from '#utils/ApiError.js';
import { planLimitsService } from '#services/saas-billing/planLimits.service.js';
import { sitesService } from '#modules/site/sites.service.js';
import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';

export class CashSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.CASH, {
      label: 'Caja',
      description: 'Puntos de caja, terminales y políticas de turno.',
    });
  }

  async get(context) {
    const [cashPoints, setting] = await Promise.all([
      CashPoint.find({ organizationId: context.organizationId })
        .sort({ displayOrder: 1, createdAt: 1 })
        .lean(),
      Setting.findOne({ organizationId: context.organizationId }).lean(),
    ]);

    const cash = setting?.cash ?? {};
    const { limits } = await planLimitsService.getContext(context.organizationId);

    return {
      cashPoints: cashPoints.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        status: p.status,
        displayOrder: p.displayOrder,
        siteId: p.siteId?.toString() ?? null,
      })),
      policies: {
        suggestedOpeningFloat: cash.suggestedOpeningFloat ?? 0,
        requireOpeningFloat: cash.requireOpeningFloat ?? false,
        requireClosingCount: cash.requireClosingCount ?? true,
        allowMultipleOpenSessions: cash.allowMultipleOpenSessions ?? false,
      },
      terminals: (cash.terminals ?? []).map((t) => ({
        name: t.name,
        code: t.code,
        status: t.status ?? 'inactive',
      })),
      limits: {
        maxCashRegisters: limits.maxCashRegisters ?? null,
      },
    };
  }

  async save(context, payload) {
    if (!Array.isArray(payload.cashPoints)) {
      throw new ApiError(400, 'Se requiere un arreglo de cajas');
    }

    if (payload.cashPoints.length === 0) {
      throw new ApiError(400, 'Debe existir al menos un punto de caja');
    }

    await planLimitsService.assertCashRegisterCount(
      context.organizationId,
      payload.cashPoints.length,
    );

    const keptIds = new Set();

    for (const [index, item] of payload.cashPoints.entries()) {
      if (!item.name?.trim()) {
        throw new ApiError(400, 'Cada caja debe tener un nombre');
      }

      const siteId = await sitesService.resolveSiteIdForCashPoint(
        context.organizationId,
        item.siteId,
      );

      const data = {
        name: item.name.trim(),
        status: item.status || 'active',
        displayOrder: item.displayOrder ?? index,
        siteId,
      };

      if (item.id) {
        const updated = await CashPoint.findOneAndUpdate(
          { _id: item.id, organizationId: context.organizationId },
          { $set: data },
          { new: true },
        );
        if (updated) {
          keptIds.add(updated._id.toString());
          continue;
        }
      }

      const created = await CashPoint.create({
        organizationId: context.organizationId,
        ...data,
      });
      keptIds.add(created._id.toString());
    }

    const existing = await CashPoint.find({ organizationId: context.organizationId });
    for (const point of existing) {
      if (!keptIds.has(point._id.toString())) {
        await point.deleteOne();
      }
    }

    const policies = payload.policies ?? {};
    const terminals = Array.isArray(payload.terminals) ? payload.terminals : [];

    await Setting.findOneAndUpdate(
      { organizationId: context.organizationId },
      {
        $set: {
          cash: {
            suggestedOpeningFloat: Number(policies.suggestedOpeningFloat) || 0,
            requireOpeningFloat: Boolean(policies.requireOpeningFloat),
            requireClosingCount:
              policies.requireClosingCount === undefined
                ? true
                : Boolean(policies.requireClosingCount),
            allowMultipleOpenSessions: Boolean(policies.allowMultipleOpenSessions),
            terminals: terminals.map((t) => ({
              name: String(t.name ?? '').trim(),
              code: String(t.code ?? '').trim(),
              status: t.status === 'active' ? 'active' : 'inactive',
            })),
          },
        },
        $setOnInsert: { organizationId: context.organizationId },
      },
      { upsert: true },
    );

    return this.get(context);
  }
}
