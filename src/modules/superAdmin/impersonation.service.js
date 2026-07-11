import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import {
  SUPER_ADMIN_AUDIT_ACTIONS,
  SUPER_ADMIN_AUDIT_MODULE,
} from './permissions.catalog.js';

/**
 * Impersonación de Organization (soporte).
 * Arquitectura preparada — implementación diferida (501).
 *
 * Flujo futuro:
 * 1. Super Admin solicita impersonar orgId + motivo
 * 2. Se emite token de corta duración con claims:
 *    { aud: 'tenant', impersonatorId, organizationId, impersonationSessionId }
 * 3. Auditoría obligatoria de inicio/fin
 * 4. UI del cliente muestra banner "Modo soporte"
 * 5. Acciones sensibles pueden bloquearse durante impersonación
 */
export class ImpersonationService {
  async start({ organizationId, actorUserId, reason }, auditContext = {}) {
    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUPER_ADMIN_AUDIT_ACTIONS.IMPERSONATION_REQUESTED,
      description: 'Solicitud de impersonación (no implementada)',
      resourceId: organizationId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { reason: reason ?? null, status: 'not_implemented' },
    });

    throw new ApiError(501, 'Impersonación preparada pero no implementada aún', {
      prepared: true,
      organizationId,
      maxDurationMinutes: 60,
      requiresReason: true,
    });
  }

  async end() {
    throw new ApiError(501, 'Impersonación preparada pero no implementada aún');
  }
}

export const impersonationService = new ImpersonationService();
