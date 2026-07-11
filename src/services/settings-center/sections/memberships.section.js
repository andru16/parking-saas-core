import mongoose from 'mongoose';
import Setting from '#modules/setting/setting.model.js';
import { ApiError } from '#utils/ApiError.js';
import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';

export class MembershipsSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.MEMBERSHIPS, {
      label: 'Membresías',
      description: 'Planes, duraciones, beneficios y recordatorios.',
    });
  }

  async get(context) {
    const setting = await Setting.findOne({ organizationId: context.organizationId }).lean();
    const plans = setting?.membershipConfig?.plans ?? [];

    return {
      plans: plans.map((p) => ({
        id: p._id?.toString?.() ?? p.id,
        name: p.name,
        durationDays: p.durationDays,
        price: p.price ?? 0,
        benefits: p.benefits ?? [],
        reminderDaysBefore: p.reminderDaysBefore ?? 3,
        isActive: p.isActive ?? true,
      })),
    };
  }

  async save(context, payload) {
    if (!Array.isArray(payload.plans)) {
      throw new ApiError(400, 'Se requiere un arreglo de planes');
    }

    const plans = payload.plans.map((p) => {
      if (!p.name?.trim()) {
        throw new ApiError(400, 'Cada plan debe tener un nombre');
      }
      if (!p.durationDays || p.durationDays < 1) {
        throw new ApiError(400, 'Cada plan debe tener duración en días (>= 1)');
      }

      const doc = {
        name: p.name.trim(),
        durationDays: Number(p.durationDays),
        price: Number(p.price) || 0,
        benefits: Array.isArray(p.benefits)
          ? p.benefits.map((b) => String(b).trim()).filter(Boolean)
          : [],
        reminderDaysBefore: Number(p.reminderDaysBefore) || 0,
        isActive: p.isActive !== false,
      };

      if (p.id && mongoose.Types.ObjectId.isValid(p.id)) {
        doc._id = new mongoose.Types.ObjectId(p.id);
      }

      return doc;
    });

    await Setting.findOneAndUpdate(
      { organizationId: context.organizationId },
      {
        $set: { membershipConfig: { plans } },
        $setOnInsert: { organizationId: context.organizationId },
      },
      { upsert: true },
    );

    return this.get(context);
  }
}
