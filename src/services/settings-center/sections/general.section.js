import Organization from '#modules/organization/organization.model.js';
import Setting from '#modules/setting/setting.model.js';
import { ApiError } from '#utils/ApiError.js';
import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';

export class GeneralSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.GENERAL, {
      label: 'Información general',
      description: 'Datos comerciales, contacto, zona horaria y moneda.',
    });
  }

  async get(context) {
    const [organization, setting] = await Promise.all([
      Organization.findById(context.organizationId).lean(),
      Setting.findOne({ organizationId: context.organizationId }).lean(),
    ]);

    return {
      commercialName: organization?.name ?? '',
      legalName: organization?.legalName ?? '',
      taxId: organization?.taxId ?? '',
      address: organization?.address ?? '',
      city: organization?.city ?? '',
      stateOrDepartment: organization?.stateOrDepartment ?? '',
      country: organization?.country ?? '',
      phone: organization?.phone ?? '',
      email: organization?.email ?? '',
      website: organization?.website ?? '',
      logo: organization?.logo ?? { url: null, path: null, uploadedAt: null },
      timezone: setting?.timezone ?? '',
      currency: setting?.currency ?? '',
      dateFormat: setting?.dateFormat ?? '',
      timeFormat: setting?.timeFormat ?? '',
    };
  }

  async save(context, payload) {
    const organization = await Organization.findById(context.organizationId);

    if (!organization) {
      throw new ApiError(404, 'Organización no encontrada');
    }

    organization.name = payload.commercialName.trim();
    organization.legalName = payload.legalName?.trim() || null;
    organization.taxId = payload.taxId?.trim() || null;
    organization.address = payload.address?.trim() || null;
    organization.city = payload.city?.trim() || null;
    organization.stateOrDepartment = payload.stateOrDepartment?.trim() || null;
    organization.country = payload.country?.trim() || null;
    organization.phone = payload.phone?.trim() || null;
    organization.email = payload.email?.trim().toLowerCase() || null;
    organization.website = payload.website?.trim() || null;

    if (payload.logo) {
      organization.logo = {
        url: payload.logo.url ?? organization.logo?.url ?? null,
        path: payload.logo.path ?? organization.logo?.path ?? null,
        uploadedAt: payload.logo.uploadedAt ?? organization.logo?.uploadedAt ?? null,
      };
    }

    await organization.save();

    await Setting.findOneAndUpdate(
      { organizationId: context.organizationId },
      {
        $set: {
          timezone: payload.timezone?.trim() || null,
          currency: payload.currency?.trim().toUpperCase() || null,
          dateFormat: payload.dateFormat?.trim() || null,
          timeFormat: payload.timeFormat || null,
        },
        $setOnInsert: { organizationId: context.organizationId },
      },
      { upsert: true, new: true },
    );

    return this.get(context);
  }
}
