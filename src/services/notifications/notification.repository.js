import mongoose from 'mongoose';
import Notification from '#modules/notification/notification.model.js';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUS,
  NOTIFICATION_INBOX_STATUS,
  normalizePriority,
  typeForPriority,
} from './notification.events.js';

/** Estados que cuentan como “activas” en el inbox (incluye legacy). */
const ACTIVE_LIKE = Object.freeze([
  NOTIFICATION_INBOX_STATUS.ACTIVE,
  NOTIFICATION_DELIVERY_STATUS.SENT,
  NOTIFICATION_DELIVERY_STATUS.DELIVERED,
  NOTIFICATION_DELIVERY_STATUS.PENDING,
  NOTIFICATION_DELIVERY_STATUS.QUEUED,
]);

/**
 * Persistencia de notificaciones. Preparado para sinks adicionales
 * (WebSockets, push, email) sin cambiar el contrato del servicio.
 */
export class NotificationRepository {
  constructor(model = Notification) {
    this.model = model;
  }

  /**
   * Audiencia visible para un usuario:
   * - propias (userId = yo)
   * - broadcast (userId = null) de su org / plataforma
   */
  buildAudienceFilter({ organizationId, userId, platform = false }) {
    const base = {
      channel: 'in_app',
      deletedAt: null,
      status: { $in: [...ACTIVE_LIKE] },
    };

    if (platform) {
      base.organizationId = null;
    } else {
      base.organizationId = organizationId;
    }

    base.$or = [{ userId }, { userId: null }];
    return base;
  }

  async createMany(docs) {
    if (!docs.length) return [];
    return this.model.insertMany(docs);
  }

  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return this.model.findById(id).lean();
  }

  async findMany(audience, filters = {}, { page = 1, limit = 25 } = {}) {
    const query = { ...this.buildAudienceFilter(audience), ...this.#filters(filters) };
    const take = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;

    const [items, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(take).lean(),
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

  async countUnread(audience) {
    const query = {
      ...this.buildAudienceFilter(audience),
      readAt: null,
    };
    return this.model.countDocuments(query);
  }

  async markRead(id, audience) {
    const query = {
      _id: id,
      ...this.buildAudienceFilter(audience),
    };
    return this.model
      .findOneAndUpdate(query, { $set: { readAt: new Date() } }, { new: true })
      .lean();
  }

  async markAllRead(audience) {
    const query = {
      ...this.buildAudienceFilter(audience),
      readAt: null,
    };
    const result = await this.model.updateMany(query, { $set: { readAt: new Date() } });
    return { modified: result.modifiedCount ?? 0 };
  }

  async softDelete(id, audience) {
    const query = {
      _id: id,
      ...this.buildAudienceFilter(audience),
    };
    return this.model
      .findOneAndUpdate(
        query,
        { $set: { deletedAt: new Date(), status: NOTIFICATION_INBOX_STATUS.ARCHIVED } },
        { new: true },
      )
      .lean();
  }

  normalizeCreatePayload(input) {
    const message = String(input.message ?? input.body ?? '').trim();
    const title = String(input.title ?? '').trim();
    const priority = normalizePriority(input.priority);
    const type = input.type || typeForPriority(priority);
    const channel = input.channel || 'in_app';

    if (!NOTIFICATION_CHANNELS.includes(channel)) {
      throw new Error(`Canal de notificación inválido: ${channel}`);
    }

    const isInApp = channel === 'in_app';

    return {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      type,
      category: input.category || 'system',
      event: input.event || 'system.manual',
      title,
      message,
      body: message,
      priority,
      status: isInApp
        ? NOTIFICATION_INBOX_STATUS.ACTIVE
        : NOTIFICATION_DELIVERY_STATUS.PENDING,
      deliveryStatus: isInApp
        ? NOTIFICATION_DELIVERY_STATUS.DELIVERED
        : NOTIFICATION_DELIVERY_STATUS.PENDING,
      provider: input.provider || 'none',
      channel,
      actionUrl: input.actionUrl ?? null,
      readAt: null,
      deletedAt: null,
      metadata: input.metadata ?? {},
    };
  }

  #filters(filters) {
    const q = {};
    if (filters.type) q.type = filters.type;
    if (filters.category) q.category = filters.category;
    if (filters.priority) q.priority = normalizePriority(filters.priority);
    if (filters.event) q.event = filters.event;
    if (filters.unreadOnly) q.readAt = null;
    if (filters.readOnly) q.readAt = { $ne: null };

    if (filters.search?.trim()) {
      const s = filters.search.trim();
      q.$and = q.$and || [];
      q.$and.push({
        $or: [
          { title: { $regex: s, $options: 'i' } },
          { message: { $regex: s, $options: 'i' } },
          { body: { $regex: s, $options: 'i' } },
        ],
      });
    }

    return q;
  }
}

export const notificationRepository = new NotificationRepository();
