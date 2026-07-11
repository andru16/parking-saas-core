import { OperationalSettingsSection } from '#services/settings-center/sections/operational.section.js';
import { SETUP_STEPS } from '../constants.js';
import { SetupStep } from './setupStep.js';

const operationalSection = new OperationalSettingsSection();

export class OperationalStep extends SetupStep {
  constructor() {
    super(SETUP_STEPS.OPERATIONAL);
  }

  async getData(context) {
    return operationalSection.get(context);
  }

  async save(context, payload) {
    return operationalSection.save(context, payload);
  }

  async validateForCompletion(context) {
    const data = await this.getData(context);
    const errors = [];

    if (data.allowOvercapacity === null || data.allowOvercapacity === undefined) {
      errors.push('Debe indicar si permite sobrecupo');
    }

    if (data.graceMinutes === null || data.graceMinutes === undefined) {
      errors.push('El tiempo de gracia es obligatorio');
    }

    if (!data.operate24Hours) {
      if (!data.openTime) errors.push('La hora de apertura es obligatoria');
      if (!data.closeTime) errors.push('La hora de cierre es obligatoria');
    }

    return errors;
  }
}
