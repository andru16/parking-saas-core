import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { getRequestContext } from '#modules/auth/auth.helpers.js';
import { tokenService } from '#modules/auth/token.service.js';
import { superAdminAuthService } from './superAdminAuth.service.js';
import { superAdminDashboardService } from './dashboard.service.js';
import { superAdminOrganizationsService } from './organizations.service.js';
import { impersonationService } from './impersonation.service.js';
import { subscriptionAlertsService } from './subscriptionAlerts.service.js';
import { subscriptionScheduler } from '#services/subscription-engine/index.js';

export const login = catchAsync(async (req, res) => {
  const result = await superAdminAuthService.login(req.body, getRequestContext(req));
  superAdminAuthService.setRefreshCookie(res, result.refreshToken);

  sendSuccess(res, {
    message: 'Inicio de sesión Super Admin exitoso',
    data: {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    },
  });
});

export const logout = catchAsync(async (req, res) => {
  let userId = null;
  try {
    const token = tokenService.extractAccessToken(req);
    if (token) {
      userId = tokenService.verifyAccessToken(token).sub;
    }
  } catch {
    // logout best-effort
  }

  await superAdminAuthService.logout({
    userId,
    refreshToken: superAdminAuthService.extractRefreshToken(req),
    ...getRequestContext(req),
  });
  superAdminAuthService.clearRefreshCookie(res);
  sendSuccess(res, { message: 'Sesión cerrada', data: null });
});

export const refresh = catchAsync(async (req, res) => {
  const result = await superAdminAuthService.refresh(
    superAdminAuthService.extractRefreshToken(req),
    getRequestContext(req),
  );
  superAdminAuthService.setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, {
    message: 'Token renovado',
    data: {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    },
  });
});

export const me = catchAsync(async (req, res) => {
  const user = await superAdminAuthService.me(req.platformAuth.userId);
  sendSuccess(res, { data: { user } });
});

export const dashboard = catchAsync(async (_req, res) => {
  const metrics = await superAdminDashboardService.getMetrics();
  sendSuccess(res, { data: { metrics } });
});

export const listPlans = catchAsync(async (req, res) => {
  const { planService } = await import('#services/saas-billing/plan.service.js');
  const includeInactive = req.query.includeInactive === 'true';
  const commercialOnly = req.query.commercialOnly !== 'false';
  const plans = await planService.list({ includeInactive, commercialOnly });
  sendSuccess(res, { data: { plans } });
});

export const listPlanFeatures = catchAsync(async (_req, res) => {
  const { planService } = await import('#services/saas-billing/plan.service.js');
  const features = await planService.listAllFeatures();
  sendSuccess(res, {
    data: {
      features: features.map((f) => ({
        id: f._id.toString(),
        key: f.key,
        label: f.label,
        category: f.category,
        description: f.description,
        sortOrder: f.sortOrder,
        isActive: f.isActive,
      })),
    },
  });
});

export const getPlan = catchAsync(async (req, res) => {
  const { planService } = await import('#services/saas-billing/plan.service.js');
  const detail = await planService.getById(req.params.planId);
  sendSuccess(res, { data: detail });
});

export const createPlan = catchAsync(async (req, res) => {
  const { planService } = await import('#services/saas-billing/plan.service.js');
  const plan = await planService.create(
    req.body,
    req.platformAuth.userId,
    getRequestContext(req),
  );
  sendSuccess(res, { statusCode: 201, message: 'Plan creado', data: { plan } });
});

export const updatePlan = catchAsync(async (req, res) => {
  const { planService } = await import('#services/saas-billing/plan.service.js');
  const plan = await planService.update(
    req.params.planId,
    req.body,
    req.platformAuth.userId,
    getRequestContext(req),
  );
  sendSuccess(res, { message: 'Plan actualizado', data: { plan } });
});

export const setPlanActive = catchAsync(async (req, res) => {
  const { planService } = await import('#services/saas-billing/plan.service.js');
  const plan = await planService.setActive(
    req.params.planId,
    Boolean(req.body.isActive),
    req.platformAuth.userId,
    getRequestContext(req),
  );
  sendSuccess(res, { message: 'Estado del plan actualizado', data: { plan } });
});

export const duplicatePlan = catchAsync(async (req, res) => {
  const { planService } = await import('#services/saas-billing/plan.service.js');
  const plan = await planService.duplicate(
    req.params.planId,
    req.platformAuth.userId,
    getRequestContext(req),
  );
  sendSuccess(res, { statusCode: 201, message: 'Plan duplicado', data: { plan } });
});

export const listOrganizations = catchAsync(async (req, res) => {
  const result = await superAdminOrganizationsService.list({
    search: req.query.search,
    status: req.query.status,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  });
  sendSuccess(res, { data: result });
});

export const getOrganization = catchAsync(async (req, res) => {
  const detail = await superAdminOrganizationsService.getById(
    req.params.organizationId,
    req.platformAuth.userId,
    getRequestContext(req),
  );
  sendSuccess(res, { data: detail });
});

export const changeOrganizationStatus = catchAsync(async (req, res) => {
  const organization = await superAdminOrganizationsService.changeStatus(
    req.params.organizationId,
    req.body.action,
    req.platformAuth.userId,
    getRequestContext(req),
  );
  sendSuccess(res, { message: 'Estado actualizado', data: { organization } });
});

export const extendTrial = catchAsync(async (req, res) => {
  const result = await superAdminOrganizationsService.extendTrial(
    req.params.organizationId,
    { days: req.body.days },
    req.platformAuth.userId,
    getRequestContext(req),
  );
  sendSuccess(res, { message: 'Trial extendido', data: result });
});

export const changePlan = catchAsync(async (req, res) => {
  const result = await superAdminOrganizationsService.changePlan(
    req.params.organizationId,
    { planId: req.body.planId },
    req.platformAuth.userId,
    getRequestContext(req),
  );
  sendSuccess(res, { message: 'Plan actualizado', data: result });
});

export const startImpersonation = catchAsync(async (req, res) => {
  await impersonationService.start(
    {
      organizationId: req.params.organizationId,
      actorUserId: req.platformAuth.userId,
      reason: req.body.reason,
    },
    getRequestContext(req),
  );
  sendSuccess(res, { data: null });
});

export const listSubscriptionAlerts = catchAsync(async (req, res) => {
  const result = await subscriptionAlertsService.list({
    filter: req.query.filter,
    search: req.query.search,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  });
  sendSuccess(res, { data: result });
});

export const getSchedulerStatus = catchAsync(async (_req, res) => {
  sendSuccess(res, { data: { scheduler: subscriptionScheduler.getStatus() } });
});

export const runSubscriptionScheduler = catchAsync(async (req, res) => {
  const result = await subscriptionScheduler.runDaily({
    source: 'super_admin',
    actorUserId: req.platformAuth.userId,
  });
  sendSuccess(res, {
    message: result.skipped ? 'Motor ya en ejecución' : 'Motor ejecutado',
    data: result,
  });
});
