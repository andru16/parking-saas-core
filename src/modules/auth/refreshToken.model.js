import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Refresh tokens persistidos para rotación, revocación y soporte multi-dispositivo.
 */
const refreshTokenSchema = new Schema(
  {
    /** Usuario propietario de la sesión */
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /** Organización del contexto (null para Super Admin) */
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },

    /** Identificador único del token (claim jti del JWT) */
    jti: {
      type: String,
      required: true,
      unique: true,
    },

    /** Familia de rotación — agrupa tokens del mismo dispositivo/sesión */
    familyId: {
      type: String,
      required: true,
      index: true,
    },

    /** Hash SHA-256 del refresh token */
    tokenHash: {
      type: String,
      required: true,
    },

    /** Fecha de expiración */
    expiresAt: {
      type: Date,
      required: true,
    },

    /** Fecha de revocación (logout o rotación) */
    revokedAt: {
      type: Date,
      default: null,
    },

    /** jti del token que reemplazó a este (rotación) */
    replacedByJti: {
      type: String,
      default: null,
    },

    /** IP del cliente al crear/rotar */
    ip: {
      type: String,
      trim: true,
      maxlength: 45,
    },

    /** User-Agent del cliente */
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    collection: 'refreshTokens',
  },
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1 });
/** TTL: Mongo elimina documentos cuando expiresAt < now */
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
