import { planService } from './plan.service.js';
import { ResolvePlanStep } from './steps/resolvePlan.step.js';
import { CreateOrganizationStep } from './steps/createOrganization.step.js';
import { CreateSubscriptionStep } from './steps/createSubscription.step.js';
import { CreateSettingsStep } from './steps/createSettings.step.js';
import { AssignOrganizationRolesStep } from './steps/assignOrganizationRoles.step.js';
import { CreateAdminUserStep } from './steps/createAdminUser.step.js';
import { CreateBootstrapAuditStep } from './steps/createBootstrapAudit.step.js';

/**
 * Registro ordenado de pasos del bootstrap.
 * Agregar nuevos pasos aquí sin modificar OrganizationBootstrapService (Open/Closed).
 */
export function createDefaultBootstrapSteps() {
  return [
    new ResolvePlanStep(planService),
    new CreateOrganizationStep(),
    new CreateSubscriptionStep(),
    new CreateSettingsStep(),
    new AssignOrganizationRolesStep(),
    new CreateAdminUserStep(),
    new CreateBootstrapAuditStep(),
  ];
}

/**
 * Inserta un paso después de otro paso existente por nombre.
 */
export function insertBootstrapStepAfter(steps, stepName, newStep) {
  const index = steps.findIndex((step) => step.name === stepName);

  if (index === -1) {
    throw new Error(`No se encontró el paso "${stepName}" en el registro de bootstrap`);
  }

  steps.splice(index + 1, 0, newStep);
  return steps;
}

/**
 * Agrega un paso al final del pipeline de bootstrap.
 */
export function appendBootstrapStep(steps, newStep) {
  steps.push(newStep);
  return steps;
}
