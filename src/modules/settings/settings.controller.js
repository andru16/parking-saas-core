import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { settingsService } from '#modules/systemSettings/settings.service.js';

const getAuditContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const listSections = catchAsync(async (req, res) => {
  const sections = await settingsService.listSectionsForOrganization(req.auth.organizationId);
  sendSuccess(res, { data: { sections } });
});

export const getSection = catchAsync(async (req, res) => {
  const result = await settingsService.getSection(
    req.auth.organizationId,
    req.params.sectionKey,
  );
  sendSuccess(res, { data: result });
});

export const saveSection = catchAsync(async (req, res) => {
  const result = await settingsService.saveSection(
    req.auth.organizationId,
    req.auth.userId,
    req.params.sectionKey,
    req.body,
    getAuditContext(req),
  );

  sendSuccess(res, {
    message: 'Configuración guardada',
    data: result,
  });
});
