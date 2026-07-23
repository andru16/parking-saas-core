import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Usuario del sistema.
 * - Super Admin: roleId (plataforma), organizationId null
 * - Usuario de org: organizationRoleId (RBAC tenant) + organizationId
 */
const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: [80, 'El nombre no puede superar 80 caracteres'],
    },

    lastName: {
      type: String,
      required: [true, 'El apellido es obligatorio'],
      trim: true,
      maxlength: [80, 'El apellido no puede superar 80 caracteres'],
    },

    email: {
      type: String,
      required: [true, 'El correo es obligatorio'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [254, 'El correo no puede superar 254 caracteres'],
      match: [/^\S+@\S+\.\S+$/, 'Formato de correo inválido'],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [30, 'El teléfono no puede superar 30 caracteres'],
      default: null,
    },

    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
      select: false,
    },

    /** Rol de plataforma (super_admin). Null para usuarios de organización. */
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
    },

    /** Rol RBAC de la Organization */
    organizationRoleId: {
      type: Schema.Types.ObjectId,
      ref: 'OrganizationRole',
      default: null,
    },

    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'pending_verification'],
        message: 'Estado inválido: {VALUE}',
      },
      default: 'active',
      required: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    /**
     * Consentimientos legales / marketing (registro).
     * Sirven para campañas por correo o SMS al contacto dejado.
     */
    consents: {
      privacyPolicyAccepted: { type: Boolean, default: false },
      privacyPolicyAcceptedAt: { type: Date, default: null },
      privacyPolicyVersion: { type: String, trim: true, default: null },
      marketingEmail: { type: Boolean, default: false },
      marketingEmailAt: { type: Date, default: null },
      marketingSms: { type: Boolean, default: false },
      marketingSmsAt: { type: Date, default: null },
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastLoginIp: {
      type: String,
      trim: true,
      maxlength: [45, 'La IP no puede superar 45 caracteres'],
      default: null,
    },

    lastLoginUserAgent: {
      type: String,
      trim: true,
      maxlength: [500, 'El user agent no puede superar 500 caracteres'],
      default: null,
    },

    /** Preparado: MFA */
    mfaEnabled: {
      type: Boolean,
      default: false,
    },

    mfaSecret: {
      type: String,
      select: false,
      default: null,
    },

    /** Preparado: SSO (Google / Microsoft / empresarial) */
    ssoProvider: {
      type: String,
      enum: {
        values: ['google', 'microsoft', 'saml'],
        message: 'Proveedor SSO inválido: {VALUE}',
      },
      default: null,
    },

    ssoSubject: {
      type: String,
      trim: true,
      default: null,
    },

    avatar: {
      type: String,
      trim: true,
      maxlength: [500, 'La URL del avatar no puede superar 500 caracteres'],
      default: null,
    },

    /** Preparado: restablecimiento de contraseña */
    passwordResetRequired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  },
);

/** Mongoose 9+: hooks sync/async sin callback `next`. */
userSchema.pre('validate', function ensureRoleAssignment() {
  if (!this.roleId && !this.organizationRoleId) {
    throw new Error('El usuario debe tener un rol de plataforma o de organización');
  }
});

userSchema.index({ organizationId: 1, status: 1 });
userSchema.index({ organizationId: 1, email: 1 });
userSchema.index({ organizationId: 1, organizationRoleId: 1 });
userSchema.index({ roleId: 1 });

const User = mongoose.model('User', userSchema);

export default User;
