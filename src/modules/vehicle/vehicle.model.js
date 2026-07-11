import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Vehículo registrado en un parqueadero.
 * Puede ser ocasional (sin memberId) o pertenecer a un Member (mensualidad, convenio, VIP).
 */
const vehicleSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    /**
     * Miembro propietario — null = vehículo ocasional (ingreso rápido).
     */
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
    },

    vehicleCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'VehicleCategory',
      required: [true, 'La categoría de vehículo es obligatoria'],
    },

    /**
     * Placa — obligatoria solo si la categoría lo exige (validación en servicio).
     * Única por organización cuando está presente.
     */
    plate: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [15, 'La placa no puede superar 15 caracteres'],
      default: null,
    },

    /** URL de fotografía (si la categoría lo requiere) */
    photoUrl: {
      type: String,
      trim: true,
      maxlength: [500, 'La URL no puede superar 500 caracteres'],
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Las observaciones no pueden superar 500 caracteres'],
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: 'Estado inválido: {VALUE}',
      },
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'vehicles',
  },
);

vehicleSchema.index(
  { organizationId: 1, plate: 1 },
  {
    unique: true,
    partialFilterExpression: { plate: { $type: 'string', $ne: null } },
    name: 'unique_plate_per_org',
  },
);
vehicleSchema.index({ organizationId: 1, memberId: 1 });
vehicleSchema.index({ organizationId: 1, vehicleCategoryId: 1 });
vehicleSchema.index({ organizationId: 1, status: 1 });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

export default Vehicle;
