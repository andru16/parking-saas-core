import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Abono / mensualidad de estacionamiento.
 * Un vehículo solo puede tener una membresía activa a la vez.
 * "Próxima a vencer" se deriva por fechas (no es estado persistido).
 */
const parkingMembershipSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'El miembro es obligatorio'],
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'El vehículo es obligatorio'],
    },
    /** Tipo / plan comercial (texto libre o nombre del plan de Settings). */
    membershipType: {
      type: String,
      trim: true,
      maxlength: [100, 'El tipo no puede superar 100 caracteres'],
      default: 'Mensualidad',
    },
    name: {
      type: String,
      required: [true, 'El nombre de la membresía es obligatorio'],
      trim: true,
      maxlength: [100, 'El nombre no puede superar 100 caracteres'],
    },
    startDate: {
      type: Date,
      required: [true, 'La fecha de inicio es obligatoria'],
    },
    endDate: {
      type: Date,
      required: [true, 'La fecha de fin es obligatoria'],
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'expired', 'suspended', 'cancelled'],
        message: 'Estado inválido: {VALUE}',
      },
      default: 'active',
      required: true,
    },
    amount: {
      type: Number,
      min: [0, 'El monto no puede ser negativo'],
      default: 0,
    },
    /** Prep. renovación automática (sin cobro automático aún). */
    autoRenew: {
      type: Boolean,
      default: false,
    },
    usageCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Las observaciones no pueden superar 500 caracteres'],
    },
  },
  {
    timestamps: true,
    collection: 'parkingMemberships',
  },
);

parkingMembershipSchema.index({ organizationId: 1, status: 1 });
parkingMembershipSchema.index({ organizationId: 1, memberId: 1 });
parkingMembershipSchema.index({ organizationId: 1, vehicleId: 1, status: 1 });
parkingMembershipSchema.index({ organizationId: 1, endDate: 1 });
parkingMembershipSchema.index(
  { organizationId: 1, vehicleId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'unique_active_membership_per_vehicle',
  },
);

const ParkingMembership = mongoose.model('ParkingMembership', parkingMembershipSchema);

export default ParkingMembership;
