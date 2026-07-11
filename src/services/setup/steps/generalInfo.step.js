import { GeneralSettingsSection } from '#services/settings-center/sections/general.section.js';
import { SETUP_STEPS } from '../constants.js';
import { SetupStep } from './setupStep.js';

const generalSection = new GeneralSettingsSection();

export class GeneralInfoStep extends SetupStep {
  constructor() {
    super(SETUP_STEPS.GENERAL_INFO);
  }

  async getData(context) {
    return generalSection.get(context);
  }

  async save(context, payload) {
    return generalSection.save(context, payload);
  }

  async validateForCompletion(context) {
    const data = await this.getData(context);
    const errors = [];

    if (!data.commercialName?.trim()) errors.push('El nombre comercial es obligatorio');
    if (!data.address?.trim()) errors.push('La dirección es obligatoria');
    if (!data.city?.trim()) errors.push('La ciudad es obligatoria');
    if (!data.country?.trim()) errors.push('El país es obligatorio');
    if (!data.phone?.trim()) errors.push('El teléfono es obligatorio');
    if (!data.email?.trim()) errors.push('El correo electrónico es obligatorio');
    if (!data.timezone?.trim()) errors.push('La zona horaria es obligatoria');
    if (!data.currency?.trim()) errors.push('La moneda es obligatoria');
    if (!data.dateFormat?.trim()) errors.push('El formato de fecha es obligatorio');
    if (!data.timeFormat) errors.push('El formato de hora es obligatorio');

    return errors;
  }
}
