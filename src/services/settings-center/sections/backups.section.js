import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';
import { backupConfigService } from '#modules/backup/backupConfig.service.js';

/** Configuración de backups automáticos por organización. */
export class BackupsSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.BACKUPS, {
      label: 'Backups',
      description: 'Frecuencia, retención y activación de copias de seguridad.',
    });
  }

  async get(context) {
    const config = await backupConfigService.getConfig(context.organizationId);
    return { backups: config };
  }

  async save(context, payload) {
    const config = await backupConfigService.saveConfig(
      context.organizationId,
      payload.backups ?? payload,
    );
    return { backups: config };
  }
}
