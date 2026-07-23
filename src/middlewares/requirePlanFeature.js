import { catchAsync } from '#utils/catchAsync.js';
import { ApiError } from '#utils/ApiError.js';
import { planLimitsService } from '#services/saas-billing/planLimits.service.js';

/**
 * Exige que el plan de la organización tenga la(s) feature(s) indicada(s).
 * Uso: router.use(requirePlanFeature('memberships'))
 */
export function requirePlanFeature(...featureKeys) {
  return catchAsync(async (req, _res, next) => {
    const organizationId = req.auth?.organizationId;
    if (!organizationId) {
      throw new ApiError(403, 'Organización requerida');
    }

    for (const key of featureKeys) {
      await planLimitsService.assertFeature(organizationId, key);
    }

    next();
  });
}
