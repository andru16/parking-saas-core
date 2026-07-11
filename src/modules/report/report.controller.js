import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { reportService } from './report.service.js';

const auditContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

const parseFilters = (query) => ({
  from: query.from ? String(query.from).slice(0, 10) : undefined,
  to: query.to ? String(query.to).slice(0, 10) : undefined,
  vehicleCategoryId: query.vehicleCategoryId,
  status: query.status,
  cashRegisterId: query.cashRegisterId,
  userId: query.userId,
  paymentMethod: query.paymentMethod,
  memberId: query.memberId,
  membershipScope: query.membershipScope,
  organizationId: query.organizationId,
});

export const getDashboardKpis = catchAsync(async (req, res) => {
  const kpis = await reportService.getDashboardKpis(req.auth, req.query);
  sendSuccess(res, { data: { kpis } });
});

export const getDashboardCharts = catchAsync(async (req, res) => {
  const charts = await reportService.getDashboardCharts(req.auth, req.query);
  sendSuccess(res, { data: { charts } });
});

export const getFilterOptions = catchAsync(async (req, res) => {
  const options = await reportService.getFilterOptions(req.auth, req.query);
  sendSuccess(res, { data: { options } });
});

export const listAllowedReports = catchAsync(async (req, res) => {
  const result = await reportService.listAllowedReports(req.auth);
  sendSuccess(res, { data: result });
});

export const generateReport = catchAsync(async (req, res) => {
  const result = await reportService.generateReport(
    req.auth,
    req.params.type,
    parseFilters(req.query),
    { page: req.query.page, limit: req.query.limit },
    auditContext(req),
  );
  sendSuccess(res, { data: result });
});

export const exportReport = catchAsync(async (req, res) => {
  const { buffer, contentType, filename } = await reportService.exportReport(
    req.auth,
    req.params.type,
    req.query.format,
    parseFilters(req.query),
    auditContext(req),
  );

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

/** Alias de arquitectura (ReportsController). */
export const ReportsController = {
  getDashboardKpis,
  getDashboardCharts,
  getFilterOptions,
  listAllowedReports,
  generateReport,
  exportReport,
};
