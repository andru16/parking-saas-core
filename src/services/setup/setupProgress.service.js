import Organization from '#modules/organization/organization.model.js';
import { SETUP_STEP_ORDER } from './constants.js';

/**
 * Gestiona el progreso persistido del Setup Wizard por organización.
 */
export class SetupProgressService {
  async getProgress(organizationId) {
    const organization = await Organization.findById(organizationId)
      .select('isSetupComplete setupProgress')
      .lean();

    return {
      isSetupComplete: organization?.isSetupComplete ?? false,
      currentStep: organization?.setupProgress?.currentStep ?? SETUP_STEP_ORDER[0],
      completedSteps: organization?.setupProgress?.completedSteps ?? [],
      lastSavedAt: organization?.setupProgress?.lastSavedAt ?? null,
      steps: SETUP_STEP_ORDER.map((key, index) => ({
        key,
        order: index + 1,
        label: this.#getStepLabel(key),
        completed: organization?.setupProgress?.completedSteps?.includes(key) ?? false,
      })),
    };
  }

  async markStepSaved(organizationId, stepKey) {
    const organization = await Organization.findById(organizationId);

    if (!organization) return;

    const completed = new Set(organization.setupProgress?.completedSteps ?? []);
    completed.add(stepKey);

    organization.setupProgress = {
      currentStep: stepKey,
      completedSteps: [...completed],
      lastSavedAt: new Date(),
    };

    await organization.save();
  }

  async markComplete(organizationId) {
    await Organization.findByIdAndUpdate(organizationId, {
      isSetupComplete: true,
      'setupProgress.lastSavedAt': new Date(),
    });
  }

  #getStepLabel(key) {
    const labels = {
      general_info: 'Información general',
      operational: 'Configuración operativa',
      vehicle_categories: 'Categorías de vehículos',
      rates: 'Tarifas',
      cash_point: 'Caja',
      summary: 'Resumen',
    };
    return labels[key] ?? key;
  }
}

export const setupProgressService = new SetupProgressService();
