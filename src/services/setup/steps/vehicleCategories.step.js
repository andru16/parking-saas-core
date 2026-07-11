import { VehicleCategoriesSettingsSection } from '#services/settings-center/sections/vehicleCategories.section.js';
import { SETUP_STEPS } from '../constants.js';
import { SetupStep } from './setupStep.js';

const categoriesSection = new VehicleCategoriesSettingsSection();

export class VehicleCategoriesStep extends SetupStep {
  constructor() {
    super(SETUP_STEPS.VEHICLE_CATEGORIES);
  }

  async getData(context) {
    return categoriesSection.get(context);
  }

  async save(context, payload) {
    return categoriesSection.save(context, payload);
  }

  async validateForCompletion(context) {
    const { categories } = await this.getData(context);
    const active = categories.filter((c) => c.isActive);

    if (active.length === 0) {
      return ['Debe configurar al menos una categoría de vehículo activa'];
    }

    return [];
  }
}
