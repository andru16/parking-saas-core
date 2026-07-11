import { RatesSettingsSection } from '#services/settings-center/sections/rates.section.js';
import { SETUP_STEPS } from '../constants.js';
import { SetupStep } from './setupStep.js';

const ratesSection = new RatesSettingsSection();

export class RatesStep extends SetupStep {
  constructor() {
    super(SETUP_STEPS.RATES);
  }

  async getData(context) {
    return ratesSection.get(context);
  }

  async save(context, payload) {
    return ratesSection.save(context, payload);
  }

  async validateForCompletion(context) {
    const { categories, rates } = await this.getData(context);
    const errors = [];
    const activeRates = rates.filter((r) => r.status === 'active');

    if (activeRates.length === 0) {
      return ['Debe configurar al menos una tarifa activa'];
    }

    for (const category of categories) {
      const categoryRates = activeRates.filter(
        (r) => r.vehicleCategoryId?.toString() === category._id.toString(),
      );

      if (categoryRates.length === 0) {
        errors.push(`La categoría "${category.name}" debe tener al menos una tarifa activa`);
      }
    }

    return errors;
  }
}
