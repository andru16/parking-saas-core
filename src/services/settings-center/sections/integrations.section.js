import Setting from '#modules/setting/setting.model.js';
import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';

const DEFAULT_INTEGRATIONS = {
  whatsapp: { enabled: false, phoneNumber: null, notes: '' },
  email: { enabled: false, fromAddress: null },
  qr: { enabled: false },
  plateReaders: { enabled: false, provider: null },
  barriers: { enabled: false, provider: null },
  api: { enabled: false, webhookUrl: null },
};

/** Placeholders de integraciones futuras — persistidos en Setting. */
export class IntegrationsSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.INTEGRATIONS, {
      label: 'Integraciones',
      description: 'WhatsApp, correo, QR, lectores, barreras y API.',
    });
  }

  async get(context) {
    const setting = await Setting.findOne({ organizationId: context.organizationId }).lean();
    const raw = setting?.integrations ?? {};

    return {
      integrations: {
        whatsapp: { ...DEFAULT_INTEGRATIONS.whatsapp, ...raw.whatsapp },
        email: { ...DEFAULT_INTEGRATIONS.email, ...raw.email },
        qr: { ...DEFAULT_INTEGRATIONS.qr, ...raw.qr },
        plateReaders: { ...DEFAULT_INTEGRATIONS.plateReaders, ...raw.plateReaders },
        barriers: { ...DEFAULT_INTEGRATIONS.barriers, ...raw.barriers },
        api: { ...DEFAULT_INTEGRATIONS.api, ...raw.api },
      },
    };
  }

  async save(context, payload) {
    const incoming = payload.integrations ?? {};

    const integrations = {
      whatsapp: {
        enabled: Boolean(incoming.whatsapp?.enabled),
        phoneNumber: incoming.whatsapp?.phoneNumber?.trim() || null,
        notes: incoming.whatsapp?.notes?.trim() ?? '',
      },
      email: {
        enabled: Boolean(incoming.email?.enabled),
        fromAddress: incoming.email?.fromAddress?.trim()?.toLowerCase() || null,
      },
      qr: {
        enabled: Boolean(incoming.qr?.enabled),
      },
      plateReaders: {
        enabled: Boolean(incoming.plateReaders?.enabled),
        provider: incoming.plateReaders?.provider?.trim() || null,
      },
      barriers: {
        enabled: Boolean(incoming.barriers?.enabled),
        provider: incoming.barriers?.provider?.trim() || null,
      },
      api: {
        enabled: Boolean(incoming.api?.enabled),
        webhookUrl: incoming.api?.webhookUrl?.trim() || null,
      },
    };

    await Setting.findOneAndUpdate(
      { organizationId: context.organizationId },
      {
        $set: { integrations },
        $setOnInsert: { organizationId: context.organizationId },
      },
      { upsert: true },
    );

    return this.get(context);
  }
}
