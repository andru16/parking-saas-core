import { settingsService } from '#modules/systemSettings/settings.service.js';

/**
 * Orquestador del Centro de Configuración (compatibilidad).
 * Delega en SettingsService — única fuente de verdad.
 */
export class SettingsCenterService {
  listSections() {
    return settingsService.listSectionsMeta();
  }

  async listSectionsForOrganization(organizationId) {
    return settingsService.listSectionsForOrganization(organizationId);
  }

  async getSection(organizationId, sectionKey) {
    return settingsService.getSection(organizationId, sectionKey);
  }

  async saveSection(organizationId, userId, sectionKey, payload, auditContext = {}) {
    return settingsService.saveSection(
      organizationId,
      userId,
      sectionKey,
      payload,
      auditContext,
    );
  }
}

export const settingsCenterService = new SettingsCenterService();
