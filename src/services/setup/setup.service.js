import Organization from '#modules/organization/organization.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { getAllSetupSteps, getSetupStep } from './setupSteps.registry.js';
import { setupProgressService } from './setupProgress.service.js';
import { SETUP_AUDIT_ACTIONS, SETUP_STEPS } from './constants.js';

/**
 * Orquestador del Setup Wizard — coordina pasos independientes.
 */
export class SetupService {
  buildContext(organizationId, userId) {
    return { organizationId, userId };
  }

  async getProgress(organizationId) {
    return setupProgressService.getProgress(organizationId);
  }

  async getStepData(organizationId, stepKey) {
    const step = getSetupStep(stepKey);
    const context = this.buildContext(organizationId);
    const data = await step.getData(context);
    const progress = await setupProgressService.getProgress(organizationId);

    return { step: stepKey, data, progress };
  }

  async saveStep(organizationId, userId, stepKey, payload, auditContext = {}) {
    const step = getSetupStep(stepKey);
    const context = this.buildContext(organizationId, userId);
    const data = await step.save(context, payload);

    await setupProgressService.markStepSaved(organizationId, stepKey);

    await auditService.log({
      userId,
      organizationId,
      module: 'setup',
      action: SETUP_AUDIT_ACTIONS.STEP_SAVED,
      description: `Paso de configuración guardado: ${stepKey}`,
      ip: auditContext.ip ?? null,
      userAgent: auditContext.userAgent ?? null,
      metadata: { step: stepKey },
    });

    const progress = await setupProgressService.getProgress(organizationId);

    return { step: stepKey, data, progress };
  }

  async getSummary(organizationId) {
    const context = this.buildContext(organizationId);
    const steps = getAllSetupSteps();
    const sections = {};

    for (const step of steps) {
      sections[step.key] = await step.getData(context);
    }

    const progress = await setupProgressService.getProgress(organizationId);

    return { sections, progress };
  }

  async complete(organizationId, userId, auditContext = {}) {
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      throw new ApiError(404, 'Organización no encontrada');
    }

    if (organization.isSetupComplete) {
      throw new ApiError(409, 'La configuración inicial ya fue completada');
    }

    const context = this.buildContext(organizationId, userId);
    const steps = getAllSetupSteps();
    const allErrors = [];

    for (const step of steps) {
      const errors = await step.validateForCompletion(context);
      allErrors.push(...errors);
    }

    // Caja: se crea automáticamente (ya no es paso del wizard).
    await getSetupStep(SETUP_STEPS.CASH_POINT).validateForCompletion(context);

    if (allErrors.length > 0) {
      throw new ApiError(400, 'La configuración está incompleta', allErrors);
    }

    await setupProgressService.markStepSaved(organizationId, SETUP_STEPS.SUMMARY);
    await setupProgressService.markComplete(organizationId);

    await auditService.log({
      userId,
      organizationId,
      module: 'setup',
      action: SETUP_AUDIT_ACTIONS.COMPLETED,
      description: 'Configuración inicial completada',
      ip: auditContext.ip ?? null,
      userAgent: auditContext.userAgent ?? null,
      resourceId: organizationId,
    });

    return {
      isSetupComplete: true,
      redirectTo: '/dashboard',
    };
  }
}

export const setupService = new SetupService();
