import { auditService } from '#services/audit/audit.service.js';
import { dashboardService } from './services/dashboard.service.js';
import { reportQueryService } from './services/reportQuery.service.js';
import { reportAccessService } from './services/reportAccess.service.js';
import { reportExportService } from './export/reportExport.service.js';
import { getExportContentType, getExportExtension } from './export/exportRegistry.js';
import {
  REPORT_AUDIT_ACTIONS,
  EXPORT_FORMATS,
  REPORT_CATALOG,
  REPORT_CATEGORIES,
} from './constants.js';
import {
  buildReportConsultedDescription,
  buildReportExportedDescription,
  getReportTypeLabel,
} from '#services/audit/audit.labels.js';

const EXPORT_ROW_LIMIT = 10_000;

/**
 * Fachada del módulo de reportes — dashboard, consultas y exportación.
 */
export class ReportService {
  async getDashboardKpis(auth, query = {}) {
    reportAccessService.assertDashboardAccess(auth);
    const organizationId = reportAccessService.resolveOrganizationId(auth, query.organizationId);
    return dashboardService.getKpis(organizationId);
  }

  async getDashboardCharts(auth, query = {}) {
    reportAccessService.assertDashboardAccess(auth);
    const organizationId = reportAccessService.resolveOrganizationId(auth, query.organizationId);
    return dashboardService.getCharts(organizationId, { days: Number(query.days) || 30 });
  }

  async getFilterOptions(auth, query = {}) {
    const organizationId = reportAccessService.resolveOrganizationId(auth, query.organizationId);
    return reportQueryService.getFilterOptions(organizationId);
  }

  async listAllowedReports(auth) {
    const allowed = reportAccessService.listAllowedReports(auth);
    const catalog = REPORT_CATALOG.filter((item) => allowed.includes(item.type));
    const byCategory = Object.values(REPORT_CATEGORIES)
      .map((category) => ({
        category,
        reports: catalog.filter((item) => item.category === category),
      }))
      .filter((group) => group.reports.length > 0);

    return {
      reports: allowed,
      catalog,
      byCategory,
    };
  }

  async generateReport(auth, reportType, filters = {}, pagination = {}, auditContext = {}) {
    const type = reportAccessService.normalizeReportType(reportType);
    reportAccessService.assertReportAccess(auth, type);

    const organizationId = reportAccessService.resolveOrganizationId(auth, filters.organizationId);

    const result = await reportQueryService.run(type, organizationId, filters, pagination);

    await auditService.log({
      userId: auth.userId,
      organizationId,
      module: 'report',
      action: REPORT_AUDIT_ACTIONS.GENERATED,
      description: buildReportConsultedDescription(type),
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: {
        reportType: type,
        filters,
        page: pagination.page,
        sensitive: reportAccessService.isSensitiveReport(type),
      },
    });

    return { reportType: type, organizationId, ...result };
  }

  async exportReport(auth, reportType, format, filters = {}, auditContext = {}) {
    const type = reportAccessService.normalizeReportType(reportType);
    reportAccessService.assertReportAccess(auth, type);

    if (!Object.values(EXPORT_FORMATS).includes(format)) {
      const { ApiError } = await import('#utils/ApiError.js');
      throw new ApiError(400, 'Formato de exportación inválido');
    }

    const organizationId = reportAccessService.resolveOrganizationId(auth, filters.organizationId);

    const result = await reportQueryService.run(type, organizationId, filters, {
      page: 1,
      limit: EXPORT_ROW_LIMIT,
    });

    const buffer = await reportExportService.export(format, {
      title: `Reporte: ${getReportTypeLabel(type)}`,
      columns: result.columns,
      rows: result.rows,
    });

    await auditService.log({
      userId: auth.userId,
      organizationId,
      module: 'report',
      action: REPORT_AUDIT_ACTIONS.EXPORTED,
      description: buildReportExportedDescription(type, format),
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { reportType: type, format, rowCount: result.rows.length, filters },
    });

    return {
      buffer,
      contentType: getExportContentType(format),
      extension: getExportExtension(format),
      filename: `reporte-${type}-${new Date().toISOString().slice(0, 10)}.${getExportExtension(format)}`,
    };
  }
}

export const reportService = new ReportService();

/** Alias de arquitectura (ReportsService). */
export { ReportService as ReportsService, reportService as reportsService };
