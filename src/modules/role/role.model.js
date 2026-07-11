import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Catálogo global de roles. No pertenece a una Organization.
 */
const roleSchema = new Schema(
  {
    /** Identificador único del rol */
    name: {
      type: String,
      required: [true, 'El nombre del rol es obligatorio'],
      unique: true,
      trim: true,
      lowercase: true,
      enum: {
        values: ['super_admin', 'organization_admin', 'supervisor', 'cashier'],
        message: 'Rol inválido: {VALUE}',
      },
    },

    /** Nombre legible para la interfaz */
    displayName: {
      type: String,
      required: [true, 'El nombre visible es obligatorio'],
      trim: true,
      maxlength: [50, 'El nombre visible no puede superar 50 caracteres'],
    },

    /** Descripción del alcance del rol */
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'La descripción no puede superar 300 caracteres'],
    },

    /** Permisos asociados (ej. tickets:create, rates:update) */
    permissions: {
      type: [String],
      default: [],
    },

    /** true = rol de plataforma (Super Admin) */
    isPlatformRole: {
      type: Boolean,
      default: false,
    },

    /** Indica si el rol está disponible para asignación */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'roles',
  },
);

roleSchema.index({ isActive: 1 });

const Role = mongoose.model('Role', roleSchema);

export default Role;
