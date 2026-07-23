import { Router } from 'express';
import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { locationsService } from '#services/locations/locations.service.js';

/**
 * Endpoints públicos (sin autenticación) para marketing / landing / selects.
 */
const router = Router();

router.get(
  '/plans',
  catchAsync(async (_req, res) => {
    const { planService } = await import('#services/saas-billing/plan.service.js');
    const plans = await planService.listPublicCatalog();

    const paidMonthly = plans
      .filter((p) => !p.isTrialPlan)
      .map((p) => Number(p.pricing?.monthly ?? 0))
      .filter((n) => n > 0);

    const startingFrom = paidMonthly.length ? Math.min(...paidMonthly) : 0;

    sendSuccess(res, {
      data: {
        plans,
        startingFrom,
        currency: 'COP',
      },
    });
  }),
);

router.get(
  '/locations/countries',
  catchAsync(async (_req, res) => {
    sendSuccess(res, { data: { countries: locationsService.listCountries() } });
  }),
);

router.get(
  '/locations/departments',
  catchAsync(async (req, res) => {
    const country = String(req.query.country ?? 'Colombia');
    const departments = await locationsService.listDepartments(country);
    sendSuccess(res, {
      data: {
        country,
        catalogDriven: locationsService.isColombia(country),
        departments,
      },
    });
  }),
);

router.get(
  '/locations/cities',
  catchAsync(async (req, res) => {
    const departmentId = req.query.departmentId;
    const cities = await locationsService.listCitiesByDepartment(departmentId);
    sendSuccess(res, { data: { departmentId: Number(departmentId), cities } });
  }),
);

export default router;
