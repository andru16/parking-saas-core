import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { settingsService } from './settings.service.js';

const auditContext = (req) => ({
  userId: req.auth?.userId ?? req.platformAuth?.userId ?? null,
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

/** Tenant — listado filtrado por plan */
export const listOrgSections = catchAsync(async (req, res) => {
  const sections = await settingsService.listSectionsForOrganization(req.auth.organizationId);
  sendSuccess(res, { data: { sections } });
});

export const getOrgSection = catchAsync(async (req, res) => {
  const result = await settingsService.getSection(
    req.auth.organizationId,
    req.params.sectionKey,
  );
  sendSuccess(res, { data: result });
});

export const saveOrgSection = catchAsync(async (req, res) => {
  const result = await settingsService.saveSection(
    req.auth.organizationId,
    req.auth.userId,
    req.params.sectionKey,
    req.body,
    auditContext(req),
  );
  sendSuccess(res, { message: 'Configuración guardada', data: result });
});

/** Plataforma — Super Admin */
export const getPlatformSettings = catchAsync(async (_req, res) => {
  const settings = await settingsService.getPlatform();
  sendSuccess(res, { data: { settings } });
});

export const updatePlatformSettings = catchAsync(async (req, res) => {
  const settings = await settingsService.updatePlatform(req.body, auditContext(req));
  sendSuccess(res, { message: 'Configuración de plataforma actualizada', data: { settings } });
});

export const SettingsController = {
  listOrgSections,
  getOrgSection,
  saveOrgSection,
  getPlatformSettings,
  updatePlatformSettings,
};
