import mongoose from 'mongoose';
import { AUDIT_RESULTS, AUDIT_USER_TYPES } from '#services/audit/audit.events.js';

const { Schema } = mongoose;

/**
 * Registro inmutable de acciones relevantes (auditoría transversal).
 * Append-only: no se actualiza ni elimina desde la aplicación.
 */
const auditLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },

    /** PlatformUser | OrganizationUser | system */
    userType: {
      type: String,
      enum: Object.values(AUDIT_USER_TYPES),
      default: AUDIT_USER_TYPES.SYSTEM,
    },

    module: {
      type: String,
      required: [true, 'El módulo es obligatorio'],
      trim: true,
      lowercase: true,
      maxlength: [50, 'El módulo no puede superar 50 caracteres'],
    },

    action: {
      type: String,
      required: [true, 'La acción es obligatoria'],
      trim: true,
      lowercase: true,
      maxlength: [80, 'La acción no puede superar 80 caracteres'],
    },

    description: {
      type: String,
      required: [true, 'La descripción es obligatoria'],
      trim: true,
      maxlength: [500, 'La descripción no puede superar 500 caracteres'],
    },

    /** Tipo de entidad afectada (ticket, user, plan, …) */
    entityType: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [60],
      default: null,
    },

    /** ID de la entidad afectada */
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    /** @deprecated Preferir entityId — se mantiene por compatibilidad */
    resourceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    result: {
      type: String,
      enum: Object.values(AUDIT_RESULTS),
      default: AUDIT_RESULTS.SUCCESS,
      required: true,
    },

    previousValues: {
      type: Schema.Types.Mixed,
      default: null,
    },

    newValues: {
      type: Schema.Types.Mixed,
      default: null,
    },

    ip: {
      type: String,
      trim: true,
      maxlength: [45, 'La IP no puede superar 45 caracteres'],
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, 'El user agent no puede superar 500 caracteres'],
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },

    /**
     * Sink de persistencia (prep. multi-destino).
     * Hoy solo mongodb; futuro: elasticsearch | opensearch | siem
     */
    sink: {
      type: String,
      default: 'mongodb',
      maxlength: [40],
    },
  },
  {
    timestamps: true,
    collection: 'auditLogs',
  },
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ result: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ userType: 1, createdAt: -1 });

/** Inmutabilidad: bloquear mutaciones y borrados. */
const IMMUTABLE_MSG = 'AuditLog es inmutable: no se permiten actualizaciones ni eliminaciones';

function rejectMutation() {
  throw new Error(IMMUTABLE_MSG);
}

auditLogSchema.pre('save', function blockUpdateOnSave() {
  if (!this.isNew) {
    throw new Error(IMMUTABLE_MSG);
  }
});

for (const hook of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
  'findOneAndRemove',
]) {
  auditLogSchema.pre(hook, rejectMutation);
}

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
