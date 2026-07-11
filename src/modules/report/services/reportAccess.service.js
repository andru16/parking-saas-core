import { ApiError } from '#utils/ApiError.js';
import { organizationAccessService } from '#services/organization/organizationAccess.service.js';
import { rbacService } from '#services/rbac/rbac.service.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import {
  ROLE_REPORT_ACCESS,
  SENSITIVE_REPORT_TYPES,
  REPORT_TYPES,
} from '../constants.js';

/** Aliases de keys RBAC nuevas ↔ nombres legacy en ROLE_REPORT_ACCESS */
const ROLE_ALIASES = Object.freeze({
  admin: 'organization_admin',
  organization_admin: 'organization_admin',
  supervisor: 'supervisor',
  cashier: 'cashier',
  super_admin: 'super_admin',
});

/**
 * Autorización de reportes/dashboard.
 * Preferir permisos RBAC; roles solo como fallback legacy.
 */
export class ReportAccessService {
  assertDashboardAccess(auth) {
    if (rbacService.hasPermission(auth.permissions, PERMISSIONS.DASHBOARD_VIEW)) {
      return;
    }
    throw new ApiError(403, 'No tiene permisos para ver el dashboard');
  }

  assertReportAccess(auth, reportType) {
    if (rbacService.hasPermission(auth.permissions, PERMISSIONS.REPORTS_VIEW)) {
      // Con reports:view se permiten los tipos del catálogo según rol (o todos si admin/*)
      const allowed = this.listAllowedReports(auth);
      if (allowed.includes(reportType)) return;
    }

    // Fallback legacy por rol
    const legacyKey = ROLE_ALIASES[auth.role] ?? auth.role;
    const byRole = ROLE_REPORT_ACCESS[legacyKey] ?? ROLE_REPORT_ACCESS[auth.role] ?? [];
    if (byRole.includes(reportType)) return;

    throw new ApiError(403, 'No tiene permisos para consultar este reporte');
  }

  resolveOrganizationId(auth, queryOrganizationId) {
    if (organizationAccessService.isPlatformUser(auth.role) || auth.isPlatformUser) {
      if (!queryOrganizationId) {
        throw new ApiError(400, 'Debe indicar organizationId para consultas de plataforma');
      }
      return queryOrganizationId;
    }
    return auth.organizationId;
  }

  isSensitiveReport(reportType) {
    return SENSITIVE_REPORT_TYPES.includes(reportType);
  }

  listAllowedReports(auth) {
    if (auth.permissions?.includes('*')) {
      return Object.values(REPORT_TYPES);
    }

    if (rbacService.hasPermission(auth.permissions, PERMISSIONS.REPORTS_VIEW)) {
      const legacyKey = ROLE_ALIASES[auth.role] ?? auth.role;
      const byRole = ROLE_REPORT_ACCESS[legacyKey] ?? ROLE_REPORT_ACCESS.admin;
      // admin key no estaba en el mapa antiguo → dar acceso completo con reports:view
      if (auth.role === 'admin' || legacyKey === 'organization_admin') {
        return Object.values(REPORT_TYPES);
      }
      if (byRole?.length) return byRole;
      return Object.values(REPORT_TYPES);
    }

    const legacyKey = ROLE_ALIASES[auth.role] ?? auth.role;
    return ROLE_REPORT_ACCESS[legacyKey] ?? [];
  }

  normalizeReportType(type) {
    const normalized = type?.toLowerCase();
    if (!Object.values(REPORT_TYPES).includes(normalized)) {
      throw new ApiError(404, 'Tipo de reporte no encontrado');
    }
    return normalized;
  }
}

export const reportAccessService = new ReportAccessService();
