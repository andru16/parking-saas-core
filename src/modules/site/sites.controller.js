import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { sitesService } from './sites.service.js';
import { planLimitsService } from '#services/saas-billing/planLimits.service.js';

const audit = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const list = catchAsync(async (req, res) => {
  const sites = await sitesService.list(req.auth.organizationId);
  const { limits, features } = await planLimitsService.getContext(req.auth.organizationId);
  sendSuccess(res, {
    data: {
      sites,
      limits: {
        maxSites: limits.maxSites ?? null,
      },
      canCreateMore:
        features?.multi_site === true &&
        (limits.maxSites == null || sites.length < limits.maxSites),
    },
  });
});

export const getOne = catchAsync(async (req, res) => {
  const site = await sitesService.getById(req.auth.organizationId, req.params.siteId);
  sendSuccess(res, { data: { site } });
});

export const create = catchAsync(async (req, res) => {
  const site = await sitesService.create(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
    audit(req),
  );
  sendSuccess(res, { statusCode: 201, message: 'Sede creada', data: { site } });
});

export const update = catchAsync(async (req, res) => {
  const site = await sitesService.update(
    req.auth.organizationId,
    req.auth.userId,
    req.params.siteId,
    req.body,
    audit(req),
  );
  sendSuccess(res, { message: 'Sede actualizada', data: { site } });
});
