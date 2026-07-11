import env from '#config/env.js';
import AuditLog from '#modules/audit/auditLog.model.js';
import { reportExportService } from '#modules/report/export/reportExport.service.js';
import { ApiError } from '#utils/ApiError.js';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  AUDIT_RESULTS,
  AUDIT_SINK_TARGETS,
  AUDIT_USER_TYPES,
} from './audit.events.js';
import {
  getAuditActionLabel,
  getAuditModuleLabel,
  humanizeAuditDescription,
} from './audit.labels.js';
import { AuditRepository } from './audit.repository.js';

const EXPORT_COLUMNS = Object.freeze([
  { key: 'createdAt', label: 'Fecha' },
  { key: 'organization', label: 'Organización' },
  { key: 'user', label: 'Usuario' },
  { key: 'userType', label: 'Tipo usuario' },
  { key: 'module', label: 'Módulo' },
  { key: 'action', label: 'Acción' },
  { key: 'entityType', label: 'Entidad' },
  { key: 'entityId', label: 'ID entidad' },
  { key: 'result', label: 'Resultado' },
  { key: 'description', label: 'Descripción' },
  { key: 'ip', label: 'IP' },
  { key: 'userAgent', label: 'User-Agent' },
]);

/**
 * Fachada única de auditoría para toda la plataforma.
 * Los módulos de negocio solo deben llamar a este servicio (no al modelo).
 */
export class AuditService {
  constructor(repository = new AuditRepository(AuditLog)) {
    this.repository = repository;
  }

  get events() {
    return {
      ACTIONS: AUDIT_ACTIONS,
      MODULES: AUDIT_MODULES,
      RESULTS: AUDIT_RESULTS,
      USER_TYPES: AUDIT_USER_TYPES,
      ENTITY_TYPES: AUDIT_ENTITY_TYPES,
      SINKS: AUDIT_SINK_TARGETS,
    };
  }

  /**
   * Registra un evento. Compatible con callers legacy (resourceId, metadata).
   * No debe romper el flujo de negocio: errores de escritura se loguean y se re-lanzan
   * solo si `throwOnError` es true (default false para no tumbar operaciones).
   */
  async log(payload, { session = null, throwOnError = false } = {}) {
    try {
      const doc = this.repository.normalizeCreatePayload(payload);
      if (!doc.module || !doc.action || !doc.description) {
        throw new Error('AuditService.log requiere module, action y description');
      }
      const created = await this.repository.create(doc, { session });
      // Hook futuro: fan-out a Elasticsearch / SIEM
      return created;
    } catch (error) {
      console.error('[AuditService] No se pudo registrar evento:', error.message);
      if (throwOnError) throw error;
      return null;
    }
  }

  /**
   * Atajo desde Express request (auth tenant o platform).
   */
  async logFromRequest(req, payload, options) {
    const auth = req.auth || req.platformAuth || {};
    const userId = payload.userId ?? auth.userId ?? auth.sub ?? null;
    const organizationId =
      payload.organizationId !== undefined
        ? payload.organizationId
        : (auth.organizationId ?? null);

    return this.log(
      {
        ...payload,
        userId,
        organizationId,
        ip: payload.ip ?? req.ip ?? null,
        userAgent: payload.userAgent ?? req.get?.('user-agent') ?? null,
        userType:
          payload.userType ??
          (req.platformAuth
            ? AUDIT_USER_TYPES.PLATFORM_USER
            : organizationId
              ? AUDIT_USER_TYPES.ORGANIZATION_USER
              : AUDIT_USER_TYPES.SYSTEM),
      },
      options,
    );
  }

  async getById(id, { organizationId = undefined } = {}) {
    const row = await this.repository.findById(id);
    if (!row) throw new ApiError(404, 'Registro de auditoría no encontrado');
    if (organizationId !== undefined) {
      const rowOrg = row.organizationId?._id?.toString?.() ?? row.organizationId?.toString?.();
      if (rowOrg !== String(organizationId)) {
        throw new ApiError(404, 'Registro de auditoría no encontrado');
      }
    }
    return this.#toDetail(row);
  }

  async list(filters, pagination) {
    const result = await this.repository.findMany(filters, pagination);
    return {
      items: result.items.map((row) => this.#toListItem(row)),
      pagination: result.pagination,
    };
  }

  async getMeta({ organizationId = undefined } = {}) {
    const [modules, actions] = await Promise.all([
      this.repository.distinctModules(organizationId),
      this.repository.distinctActions(organizationId),
    ]);

    return {
      modules: modules.filter(Boolean).sort(),
      actions: actions.filter(Boolean).sort(),
      results: Object.values(AUDIT_RESULTS),
      userTypes: Object.values(AUDIT_USER_TYPES),
      retention: this.getRetentionPolicy(),
      sinks: AUDIT_SINK_TARGETS,
    };
  }

  getRetentionPolicy() {
    const months = env.audit.retentionMonths;
    return {
      months,
      label: this.#retentionLabel(months),
      autoDeleteEnabled: false,
      note: 'La purga automática no está activa. Solo se expone la política configurable.',
      cutoffPreview: this.getRetentionCutoffDate().toISOString(),
    };
  }

  getRetentionCutoffDate(now = new Date()) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - env.audit.retentionMonths);
    return d;
  }

  /**
   * Preview de cuántos registros caerían fuera de la retención (sin borrar).
   */
  async previewRetentionPurge({ organizationId = null } = {}) {
    const cutoff = this.getRetentionCutoffDate();
    const count = await this.repository.countOlderThan(cutoff, organizationId);
    return {
      cutoff: cutoff.toISOString(),
      matchingDocuments: count,
      wouldDelete: false,
      policy: this.getRetentionPolicy(),
    };
  }

  async export(filters, format = 'xlsx') {
    const rows = await this.repository.findForExport(filters);
    const mapped = rows.map((row) => ({
      createdAt: row.createdAt,
      organization: row.organizationId?.name ?? (row.organizationId ? String(row.organizationId) : 'Plataforma'),
      user: row.userId
        ? `${row.userId.firstName ?? ''} ${row.userId.lastName ?? ''}`.trim() ||
          row.userId.email ||
          String(row.userId._id)
        : 'Sistema',
      userType: row.userType ?? '',
      module: getAuditModuleLabel(row.module),
      action: getAuditActionLabel(row.action),
      entityType: row.entityType ?? '',
      entityId: row.entityId?.toString?.() ?? row.resourceId?.toString?.() ?? '',
      result: row.result ?? 'success',
      description: humanizeAuditDescription(row.description, {
        action: row.action,
        module: row.module,
      }),
      ip: row.ip ?? '',
      userAgent: row.userAgent ?? '',
    }));

    const buffer = await reportExportService.export(format, {
      title: 'Auditoría Parking SaaS',
      columns: EXPORT_COLUMNS,
      rows: mapped,
    });

    return { buffer, format };
  }

  #retentionLabel(months) {
    if (months === 6) return '6 meses';
    if (months === 12) return '1 año';
    if (months === 24) return '2 años';
    return `${months} meses`;
  }

  #toListItem(row) {
    return {
      id: row._id.toString(),
      createdAt: row.createdAt,
      module: getAuditModuleLabel(row.module),
      moduleCode: row.module,
      action: getAuditActionLabel(row.action),
      actionCode: row.action,
      description: humanizeAuditDescription(row.description, {
        action: row.action,
        module: row.module,
      }),
      result: row.result ?? AUDIT_RESULTS.SUCCESS,
      userType: row.userType ?? null,
      entityType: row.entityType ?? null,
      entityId: row.entityId?.toString?.() ?? row.resourceId?.toString?.() ?? null,
      ip: row.ip ?? null,
      user: row.userId
        ? {
            id: row.userId._id.toString(),
            name: `${row.userId.firstName ?? ''} ${row.userId.lastName ?? ''}`.trim(),
            email: row.userId.email ?? null,
          }
        : null,
      organization: row.organizationId
        ? {
            id: row.organizationId._id.toString(),
            name: row.organizationId.name,
            email: row.organizationId.email ?? null,
            status: row.organizationId.status ?? null,
          }
        : null,
    };
  }

  #toDetail(row) {
    return {
      ...this.#toListItem(row),
      userAgent: row.userAgent ?? null,
      previousValues: row.previousValues ?? null,
      newValues: row.newValues ?? null,
      metadata: row.metadata ?? null,
      sink: row.sink ?? 'mongodb',
      resourceId: row.resourceId?.toString?.() ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }
}

export const auditService = new AuditService();
