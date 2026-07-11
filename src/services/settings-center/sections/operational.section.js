import Setting from '#modules/setting/setting.model.js';
import { ApiError } from '#utils/ApiError.js';
import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';

export class OperationalSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.OPERATIONAL, {
      label: 'Operación',
      description: 'Horarios, capacidad y reglas operativas.',
    });
  }

  async get(context) {
    const setting = await Setting.findOne({ organizationId: context.organizationId }).lean();

    return {
      openTime: setting?.operatingHours?.openTime ?? '',
      closeTime: setting?.operatingHours?.closeTime ?? '',
      operate24Hours: setting?.operatingHours?.operate24Hours ?? false,
      allowOvercapacity: setting?.allowOvercapacity ?? false,
      graceMinutes: setting?.graceMinutes ?? null,
      maxCapacity: setting?.maxCapacity ?? null,
    };
  }

  async save(context, payload) {
    const update = {
      'operatingHours.operate24Hours': Boolean(payload.operate24Hours),
      'operatingHours.openTime': payload.operate24Hours ? null : payload.openTime || null,
      'operatingHours.closeTime': payload.operate24Hours ? null : payload.closeTime || null,
      allowOvercapacity: payload.allowOvercapacity,
      graceMinutes: payload.graceMinutes,
      maxCapacity: payload.maxCapacity ?? null,
    };

    const setting = await Setting.findOneAndUpdate(
      { organizationId: context.organizationId },
      { $set: update, $setOnInsert: { organizationId: context.organizationId } },
      { upsert: true, new: true },
    );

    if (!setting) {
      throw new ApiError(500, 'No se pudo guardar la configuración operativa');
    }

    return this.get(context);
  }
}
