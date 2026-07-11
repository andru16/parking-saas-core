import mongoose from 'mongoose';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_DELIVERY_STATUS,
  NOTIFICATION_INBOX_STATUS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
  LEGACY_PRIORITY_NORMAL,
} from '#services/notifications/notification.events.js';

const { Schema } = mongoose;

/**
 * Notificación in-app (+ cola preparada para email/WhatsApp/SMS/push).
 * organizationId null = notificación de plataforma (Super Admin).
 * userId null = audiencia org/plataforma completa.
 */
const notificationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      default: NOTIFICATION_TYPES.INFO,
      required: true,
    },

    category: {
      type: String,
      enum: Object.values(NOTIFICATION_CATEGORIES),
      default: NOTIFICATION_CATEGORIES.SYSTEM,
      required: true,
      index: true,
    },

    /** Código de evento de dominio (machine-readable) */
    event: {
      type: String,
      required: true,
      index: true,
      trim: true,
      maxlength: 120,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    /** Mensaje visible (alias API: message) */
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    /** @deprecated Preferir `message` — se sincroniza al guardar */
    body: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    priority: {
      type: String,
      enum: [...Object.values(NOTIFICATION_PRIORITIES), LEGACY_PRIORITY_NORMAL],
      default: NOTIFICATION_PRIORITIES.MEDIUM,
    },

    /**
     * Estado del inbox.
     * Incluye valores legacy de delivery (`sent`, `pending`, …) por compatibilidad
     * con documentos creados antes del Centro de Notificaciones.
     */
    status: {
      type: String,
      enum: [
        ...Object.values(NOTIFICATION_INBOX_STATUS),
        ...Object.values(NOTIFICATION_DELIVERY_STATUS),
      ],
      default: NOTIFICATION_INBOX_STATUS.ACTIVE,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    /** Deep link opcional en la app */
    actionUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    /**
     * Canal de entrega.
     * El Centro de Notificaciones solo lista `in_app`.
     */
    channel: {
      type: String,
      enum: NOTIFICATION_CHANNELS,
      required: true,
      default: 'in_app',
      index: true,
    },

    /** Estado de entrega (canales externos / prep.) */
    deliveryStatus: {
      type: String,
      enum: Object.values(NOTIFICATION_DELIVERY_STATUS),
      default: NOTIFICATION_DELIVERY_STATUS.DELIVERED,
    },

    provider: {
      type: String,
      default: 'none',
      maxlength: 40,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'notifications',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

notificationSchema.virtual('isRead').get(function isRead() {
  return Boolean(this.readAt);
});

notificationSchema.pre('validate', function syncMessageBody() {
  if (this.message && !this.body) this.body = this.message;
  if (this.body && !this.message) this.message = this.body;
  if (this.priority === LEGACY_PRIORITY_NORMAL) {
    this.priority = NOTIFICATION_PRIORITIES.MEDIUM;
  }
});

notificationSchema.index({ organizationId: 1, channel: 1, deletedAt: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, channel: 1, deletedAt: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ organizationId: 1, userId: 1, channel: 1, createdAt: -1 });
notificationSchema.index({ category: 1, createdAt: -1 });
notificationSchema.index({ event: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
