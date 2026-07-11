import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Token de verificación de correo u otras acciones sensibles.
 */
const verificationTokenSchema = new Schema(
  {
    /** Usuario al que pertenece el token */
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es obligatorio'],
    },

    /** Organización asociada al token */
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    /** Hash SHA-256 del token (nunca almacenar el token en texto plano) */
    tokenHash: {
      type: String,
      required: [true, 'El hash del token es obligatorio'],
      select: false,
    },

    /** Tipo de verificación */
    type: {
      type: String,
      enum: {
        values: ['email_verification'],
        message: 'Tipo de token inválido: {VALUE}',
      },
      default: 'email_verification',
      required: true,
    },

    /** Fecha de expiración del token */
    expiresAt: {
      type: Date,
      required: [true, 'La fecha de expiración es obligatoria'],
    },

    /** Fecha en que el token fue utilizado */
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'verificationTokens',
  },
);

verificationTokenSchema.index({ userId: 1, type: 1, usedAt: 1 });
/** TTL automático de tokens expirados */
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);

export default VerificationToken;
