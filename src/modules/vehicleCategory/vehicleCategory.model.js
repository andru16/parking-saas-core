import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Categoría de vehículo configurable por organización.
 * El sistema nunca asume categorías fijas — cada parqueadero define las suyas.
 */
const vehicleCategorySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: [80, 'El nombre no puede superar 80 caracteres'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [300, 'La descripción no puede superar 300 caracteres'],
      default: '',
    },

    /** Identificador de icono (librería UI o clave interna) */
    icon: {
      type: String,
      trim: true,
      maxlength: [50, 'El icono no puede superar 50 caracteres'],
      default: 'vehicle',
    },

    /** Color en formato hexadecimal (#RRGGBB) */
    color: {
      type: String,
      trim: true,
      match: [/^#[0-9A-Fa-f]{6}$/, 'El color debe ser hexadecimal (#RRGGBB)'],
      default: '#3B82F6',
    },

    displayOrder: {
      type: Number,
      min: [0, 'El orden no puede ser negativo'],
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    requirements: {
      requiresPlate: { type: Boolean, default: true },
      requiresOwner: { type: Boolean, default: false },
      requiresPhoto: { type: Boolean, default: false },
      requiresNotes: { type: Boolean, default: false },
    },

    /** Eliminación lógica — conserva historial y referencias */
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'vehicleCategories',
  },
);

vehicleCategorySchema.index({ organizationId: 1, isDeleted: 1, displayOrder: 1 });
vehicleCategorySchema.index(
  { organizationId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
    collation: { locale: 'en', strength: 2 },
  },
);

const VehicleCategory = mongoose.model('VehicleCategory', vehicleCategorySchema);

export default VehicleCategory;
