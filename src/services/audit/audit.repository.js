import mongoose from 'mongoose';
import '#modules/user/user.model.js';
import '#modules/organization/organization.model.js';
import {
  AUDIT_RESULTS,
  AUDIT_USER_TYPES,
  inferResultFromAction,
  inferUserType,
} from './audit.events.js';
import { AUDIT_ACTIONS_HIDDEN_FROM_CLIENT } from './audit.labels.js';

/**
 * Persistencia de AuditLog — única capa que habla con MongoDB.
 * Preparado para sustituir/añadir sinks (Elasticsearch, OpenSearch, SIEM).
 */
export class AuditRepository {
  constructor(model) {
    this.model = model;
  }

  async create(doc, { session = null } = {}) {
    if (session) {
      const [created] = await this.model.create([doc], { session });
      return created;
    }
    return this.model.create(doc);
  }

  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return this.model
      .findById(id)
      .populate('userId', 'firstName lastName email')
      .populate('organizationId', 'name email status')
      .lean();
  }

  /**
   * Listado filtrado + paginación. Índices: org+createdAt, module+action, createdAt.
   */
  async findMany(filters, { page = 1, limit = 25, sort = { createdAt: -1 } } = {}) {
    const query = this.#buildQuery(filters);
    const take = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;

    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .populate('userId', 'firstName lastName email')
        .populate('organizationId', 'name email status')
        .sort(sort)
        .skip(skip)
        .limit(take)
        .lean(),
      this.model.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page: Math.max(1, page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  async findForExport(filters, { limit = 10_000 } = {}) {
    const query = this.#buildQuery(filters);
    return this.model
      .find(query)
      .populate('userId', 'firstName lastName email')
      .populate('organizationId', 'name email')
      .sort({ createdAt: -1 })
      .limit(Math.min(10_000, Math.max(1, limit)))
      .lean();
  }

  async distinctModules(organizationId = undefined) {
    const match = {};
    if (organizationId !== undefined) match.organizationId = organizationId;
    return this.model.distinct('module', match);
  }

  async distinctActions(organizationId = undefined) {
    const match = {};
    if (organizationId !== undefined) match.organizationId = organizationId;
    return this.model.distinct('action', match);
  }

  /**
   * Preview de retención (no elimina).
   */
  async countOlderThan(cutoffDate, organizationId = null) {
    const filter = { createdAt: { $lt: cutoffDate } };
    if (organizationId) filter.organizationId = organizationId;
    return this.model.countDocuments(filter);
  }

  normalizeCreatePayload(input) {
    const action = String(input.action || '').trim().toLowerCase();
    const module = String(input.module || '').trim().toLowerCase();
    const result = inferResultFromAction(action, input.result);
    const userType = inferUserType({
      userType: input.userType,
      userId: input.userId,
      organizationId: input.organizationId,
      module,
    });

    const entityId = input.entityId ?? input.resourceId ?? null;
    const previousValues = input.previousValues ?? input.metadata?.previous ?? null;
    const newValues = input.newValues ?? input.metadata?.next ?? input.metadata?.new ?? null;

    return {
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      userType,
      module,
      action,
      description: String(input.description || '').trim().slice(0, 500),
      entityType: input.entityType ?? null,
      entityId,
      resourceId: entityId,
      result,
      previousValues,
      newValues,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? null,
      sink: input.sink ?? 'mongodb',
    };
  }

  #buildQuery(filters = {}) {
    const q = {};

    if (filters.organizationId) {
      q.organizationId = filters.organizationId;
    } else if (filters.organizationId === null && filters.platformOnly) {
      q.organizationId = null;
    }

    if (filters.userId) q.userId = filters.userId;
    if (filters.module) q.module = String(filters.module).toLowerCase();
    if (filters.action) {
      q.action = String(filters.action).toLowerCase();
    } else if (filters.organizationId && !filters.includeInternalActions) {
      // Vista de cliente: ocultar renovaciones de sesión y ruido técnico
      q.action = { $nin: [...AUDIT_ACTIONS_HIDDEN_FROM_CLIENT] };
    }
    if (filters.result) q.result = filters.result;
    if (filters.userType) q.userType = filters.userType;
    if (filters.entityType) q.entityType = filters.entityType;
    if (filters.entityId) q.entityId = filters.entityId;
    if (filters.resourceId) q.resourceId = filters.resourceId;

    if (filters.search?.trim()) {
      const s = filters.search.trim();
      q.$or = [
        { description: { $regex: s, $options: 'i' } },
        { action: { $regex: s, $options: 'i' } },
        { module: { $regex: s, $options: 'i' } },
        { entityType: { $regex: s, $options: 'i' } },
      ];
    }

    if (filters.from || filters.to) {
      q.createdAt = {};
      if (filters.from) q.createdAt.$gte = new Date(filters.from);
      if (filters.to) {
        const to = new Date(filters.to);
        // incluir el día completo si viene como fecha sin hora
        if (String(filters.to).length <= 10) {
          to.setHours(23, 59, 59, 999);
        }
        q.createdAt.$lte = to;
      }
    }

    return q;
  }
}

export function createAuditRepository(AuditLogModel) {
  return new AuditRepository(AuditLogModel);
}

export { AUDIT_RESULTS, AUDIT_USER_TYPES };
