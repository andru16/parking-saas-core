import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Rol perteneciente a una Organization (RBAC multi-tenant).
 * Los permisos son códigos del catálogo (módulo:acción).
 *
 * Extensiones futuras: parentRoleId (herencia), temporaryUntil, MFA/SSO a nivel usuario.
 */
const organizationRoleSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    /** Clave estable única por org (admin, supervisor, cashier o slug custom) */
    key: {
      type: String,
      required: [true, 'La clave del rol es obligatoria'],
      trim: true,
      lowercase: true,
      maxlength: [60, 'La clave no puede superar 60 caracteres'],
    },

    name: {
      type: String,
      required: [true, 'El nombre del rol es obligatorio'],
      trim: true,
      maxlength: [80, 'El nombre no puede superar 80 caracteres'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [300, 'La descripción no puede superar 300 caracteres'],
      default: '',
    },

    permissions: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    /** Roles sembrados al crear la org — no se eliminan */
    isSystem: {
      type: Boolean,
      default: false,
    },

    /** Preparado: herencia de roles */
    parentRoleId: {
      type: Schema.Types.ObjectId,
      ref: 'OrganizationRole',
      default: null,
    },

    /** Preparado: permisos temporales */
    temporaryUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'organizationRoles',
  },
);

organizationRoleSchema.index({ organizationId: 1, key: 1 }, { unique: true });
organizationRoleSchema.index({ organizationId: 1, isActive: 1 });

const OrganizationRole = mongoose.model('OrganizationRole', organizationRoleSchema);

export default OrganizationRole;
