import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
  normalizePriority,
} from './notification.events.js';
import { notificationRepository } from './notification.repository.js';

/**
 * Centro de Notificaciones — fachada única para toda la plataforma.
 *
 * - In-app: listado, lectura, borrado (este módulo).
 * - Email / WhatsApp / SMS / push / WebSockets: se encolan vía `emit({ channels })`
 *   sin cambiar este servicio cuando se conecten proveedores.
 */
export class NotificationService {
  constructor(repository = notificationRepository) {
    this.repository = repository;
  }

  get events() {
    return NOTIFICATION_EVENTS;
  }

  get channels() {
    return NOTIFICATION_CHANNELS;
  }

  get types() {
    return NOTIFICATION_TYPES;
  }

  get priorities() {
    return NOTIFICATION_PRIORITIES;
  }

  get categories() {
    return NOTIFICATION_CATEGORIES;
  }

  /**
   * Crea notificaciones en los canales indicados.
   * Por defecto solo `in_app` (sin email/WhatsApp todavía).
   */
  async emit(payload, { channels = ['in_app'], actorUserId = null, auditContext = {} } = {}) {
    const message = payload.message ?? payload.body;
    if (!payload.title || !message) {
      throw new Error('NotificationService.emit requiere title y message/body');
    }

    // Plataforma: organizationId null. Tenant: organizationId obligatorio.
    if (payload.organizationId === undefined) {
      throw new Error('NotificationService.emit requiere organizationId (o null para plataforma)');
    }

    const channelList = (channels?.length ? channels : ['in_app']).filter((c) =>
      NOTIFICATION_CHANNELS.includes(c),
    );

    const docs = channelList.map((channel) =>
      this.repository.normalizeCreatePayload({
        ...payload,
        message,
        body: message,
        channel,
        priority: normalizePriority(payload.priority),
      }),
    );

    const created = await this.repository.createMany(docs);
    const inApp = created.find((n) => n.channel === 'in_app');

    if (inApp) {
      await auditService.log({
        userId: actorUserId,
        organizationId: payload.organizationId,
        module: 'notifications',
        action: 'notification_created',
        description: `Notificación creada: ${payload.title}`,
        entityType: 'notification',
        entityId: inApp._id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
          event: payload.event,
          category: payload.category,
          channels: channelList,
        },
      });
    }

    return created.map((n) => this.#toItem(n));
  }

  /** Alias semántico para crear solo in-app */
  async create(payload, options = {}) {
    return this.emit(payload, { ...options, channels: ['in_app'] });
  }

  async list(audience, filters, pagination) {
    const result = await this.repository.findMany(audience, filters, pagination);
    return {
      items: result.items.map((row) => this.#toItem(row)),
      pagination: result.pagination,
    };
  }

  async countUnread(audience) {
    const count = await this.repository.countUnread(audience);
    return { unread: count };
  }

  async getById(id, audience) {
    const row = await this.repository.findById(id);
    if (!row || row.deletedAt || row.channel !== 'in_app') {
      throw new ApiError(404, 'Notificación no encontrada');
    }
    if (!this.#isVisibleTo(row, audience)) {
      throw new ApiError(404, 'Notificación no encontrada');
    }
    return this.#toItem(row);
  }

  async markRead(id, audience, { actorUserId = null, auditContext = {} } = {}) {
    const updated = await this.repository.markRead(id, audience);
    if (!updated) throw new ApiError(404, 'Notificación no encontrada');

    await auditService.log({
      userId: actorUserId ?? audience.userId,
      organizationId: audience.organizationId ?? null,
      module: 'notifications',
      action: 'notification_read',
      description: 'Notificación marcada como leída',
      entityType: 'notification',
      entityId: id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.#toItem(updated);
  }

  async markAllRead(audience, { actorUserId = null, auditContext = {} } = {}) {
    const result = await this.repository.markAllRead(audience);

    await auditService.log({
      userId: actorUserId ?? audience.userId,
      organizationId: audience.organizationId ?? null,
      module: 'notifications',
      action: 'notification_read_all',
      description: `Todas las notificaciones marcadas como leídas (${result.modified})`,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { modified: result.modified },
    });

    return result;
  }

  async remove(id, audience, { actorUserId = null, auditContext = {} } = {}) {
    const updated = await this.repository.softDelete(id, audience);
    if (!updated) throw new ApiError(404, 'Notificación no encontrada');

    await auditService.log({
      userId: actorUserId ?? audience.userId,
      organizationId: audience.organizationId ?? null,
      module: 'notifications',
      action: 'notification_deleted',
      description: 'Notificación eliminada',
      entityType: 'notification',
      entityId: id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return { id: String(id), deleted: true };
  }

  async getMeta() {
    return {
      types: Object.values(NOTIFICATION_TYPES),
      priorities: Object.values(NOTIFICATION_PRIORITIES),
      categories: Object.values(NOTIFICATION_CATEGORIES),
      channels: [...NOTIFICATION_CHANNELS],
      externalChannelsPrepared: ['email', 'whatsapp', 'sms', 'push'],
      realtimePrepared: ['websockets'],
    };
  }

  #isVisibleTo(row, audience) {
    if (row.deletedAt) return false;
    if (audience.platform) {
      if (row.organizationId != null) return false;
    } else if (String(row.organizationId) !== String(audience.organizationId)) {
      return false;
    }
    if (row.userId == null) return true;
    return String(row.userId) === String(audience.userId);
  }

  #toItem(row) {
    const message = row.message || row.body || '';
    return {
      id: row._id.toString(),
      organizationId: row.organizationId?.toString?.() ?? row.organizationId ?? null,
      userId: row.userId?.toString?.() ?? row.userId ?? null,
      type: row.type || 'info',
      category: row.category || 'system',
      event: row.event,
      title: row.title,
      message,
      body: message,
      priority: normalizePriority(row.priority),
      status: row.status,
      isRead: Boolean(row.readAt),
      readAt: row.readAt ?? null,
      actionUrl: row.actionUrl ?? null,
      channel: row.channel,
      deliveryStatus: row.deliveryStatus ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      metadata: row.metadata ?? {},
    };
  }
}

export const notificationService = new NotificationService();
