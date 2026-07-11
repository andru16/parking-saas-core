import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { auditService } from '#services/audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '#services/audit/audit.events.js';

function parseFilters(query, { forceOrganizationId } = {}) {
  return {
    search: query.search,
    module: query.module,
    action: query.action,
    result: query.result,
    userType: query.userType,
    userId: query.userId,
    organizationId:
      forceOrganizationId !== undefined ? forceOrganizationId : query.organizationId,
    entityType: query.entityType,
    from: query.from,
    to: query.to,
  };
}

function exportHeaders(res, format, buffer) {
  const map = {
    csv: { type: 'text/csv; charset=utf-8', ext: 'csv' },
    xlsx: {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ext: 'xlsx',
    },
    pdf: { type: 'application/pdf', ext: 'pdf' },
  };
  const meta = map[format] || map.xlsx;
  res.setHeader('Content-Type', meta.type);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.${meta.ext}"`,
  );
  res.send(buffer);
}

/** ——— Tenant (Organization) ——— */

export const listOrgAudit = catchAsync(async (req, res) => {
  const organizationId = req.auth.organizationId;
  const result = await auditService.list(parseFilters(req.query, { forceOrganizationId: organizationId }), {
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 25,
  });
  sendSuccess(res, { data: result });
});

export const getOrgAudit = catchAsync(async (req, res) => {
  const detail = await auditService.getById(req.params.auditId, {
    organizationId: req.auth.organizationId,
  });
  sendSuccess(res, { data: { item: detail } });
});

export const metaOrgAudit = catchAsync(async (req, res) => {
  const meta = await auditService.getMeta({ organizationId: req.auth.organizationId });
  sendSuccess(res, { data: meta });
});

export const exportOrgAudit = catchAsync(async (req, res) => {
  const format = req.query.format || 'xlsx';
  const organizationId = req.auth.organizationId;
  const { buffer } = await auditService.export(
    parseFilters(req.query, { forceOrganizationId: organizationId }),
    format,
  );

  await auditService.logFromRequest(req, {
    module: AUDIT_MODULES.AUDIT,
    action: AUDIT_ACTIONS.AUDIT_EXPORTED,
    description: `Exportación de auditoría (${format})`,
    metadata: { format, scope: 'organization' },
  });

  exportHeaders(res, format, buffer);
});

export const retentionOrgAudit = catchAsync(async (req, res) => {
  const preview = await auditService.previewRetentionPurge({
    organizationId: req.auth.organizationId,
  });
  sendSuccess(res, { data: preview });
});

/** ——— Super Admin (plataforma) ——— */

export const listPlatformAudit = catchAsync(async (req, res) => {
  const result = await auditService.list(parseFilters(req.query), {
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 25,
  });
  sendSuccess(res, { data: result });
});

export const getPlatformAudit = catchAsync(async (req, res) => {
  const detail = await auditService.getById(req.params.auditId);
  sendSuccess(res, { data: { item: detail } });
});

export const metaPlatformAudit = catchAsync(async (_req, res) => {
  const meta = await auditService.getMeta();
  sendSuccess(res, { data: meta });
});

export const exportPlatformAudit = catchAsync(async (req, res) => {
  const format = req.query.format || 'xlsx';
  const { buffer } = await auditService.export(parseFilters(req.query), format);

  await auditService.logFromRequest(req, {
    module: AUDIT_MODULES.AUDIT,
    action: AUDIT_ACTIONS.AUDIT_EXPORTED,
    description: `Exportación de auditoría plataforma (${format})`,
    organizationId: null,
    metadata: { format, scope: 'platform' },
  });

  exportHeaders(res, format, buffer);
});

export const retentionPlatformAudit = catchAsync(async (req, res) => {
  const organizationId = req.query.organizationId || null;
  const preview = await auditService.previewRetentionPurge({ organizationId });
  sendSuccess(res, { data: preview });
});
