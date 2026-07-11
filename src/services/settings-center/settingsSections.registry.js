import { ApiError } from '#utils/ApiError.js';
import { SETTINGS_SECTION_ORDER } from './constants.js';
import { BackupsSettingsSection } from './sections/backups.section.js';
import { CashSettingsSection } from './sections/cash.section.js';
import { GeneralSettingsSection } from './sections/general.section.js';
import { IntegrationsSettingsSection } from './sections/integrations.section.js';
import { MembershipsSettingsSection } from './sections/memberships.section.js';
import { OperationalSettingsSection } from './sections/operational.section.js';
import { PaymentMethodsSettingsSection } from './sections/paymentMethods.section.js';
import { PrintingSettingsSection } from './sections/printing.section.js';
import { RatesSettingsSection } from './sections/rates.section.js';
import { UsersSettingsSection } from './sections/users.section.js';
import { VehicleCategoriesSettingsSection } from './sections/vehicleCategories.section.js';

/**
 * Registro Open/Closed de secciones.
 * Para agregar una sección: crear el servicio e incluirlo en SECTION_INSTANCES.
 */
const SECTION_INSTANCES = [
  new GeneralSettingsSection(),
  new OperationalSettingsSection(),
  new VehicleCategoriesSettingsSection(),
  new RatesSettingsSection(),
  new PaymentMethodsSettingsSection(),
  new CashSettingsSection(),
  new PrintingSettingsSection(),
  new MembershipsSettingsSection(),
  new UsersSettingsSection(),
  new IntegrationsSettingsSection(),
  new BackupsSettingsSection(),
];

const sectionByKey = new Map(SECTION_INSTANCES.map((s) => [s.key, s]));

export function getSettingsSection(sectionKey) {
  const section = sectionByKey.get(sectionKey);
  if (!section) {
    throw new ApiError(404, `Sección de configuración no encontrada: ${sectionKey}`);
  }
  return section;
}

export function listSettingsSections() {
  return SETTINGS_SECTION_ORDER.map((key) => {
    const section = sectionByKey.get(key);
    return section.getMeta();
  });
}

export function getAllSettingsSections() {
  return SETTINGS_SECTION_ORDER.map((key) => sectionByKey.get(key));
}
