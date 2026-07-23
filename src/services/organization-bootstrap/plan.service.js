import { ApiError } from '#utils/ApiError.js';
import { planService as billingPlanService } from '#services/saas-billing/plan.service.js';

/**
 * Resuelve el plan de suscripción a utilizar en el bootstrap.
 * Delega en PlanService del módulo saas-billing (sin planes quemados).
 */
export class BootstrapPlanResolver {
  async resolvePlan(planId, session) {
    if (planId) {
      return billingPlanService.resolveActivePlanById(planId, session);
    }

    try {
      return await billingPlanService.resolveTrialPlan(session);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        500,
        'El plan Trial no está configurado. Ejecute el seed / Super Admin → Planes.',
      );
    }
  }

  async resolvePlanByCode(planCode, session) {
    if (!planCode) return this.resolvePlan(null, session);
    return billingPlanService.resolveActivePlanByCode(planCode, session);
  }
}

/** Compat con el registry de bootstrap */
export const planService = new BootstrapPlanResolver();

/** @deprecated Alias histórico */
export const PlanService = BootstrapPlanResolver;
