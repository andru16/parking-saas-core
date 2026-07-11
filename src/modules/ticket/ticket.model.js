import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Registro completo de una estadía en el parqueadero (ingreso → salida).
 * Estados: open (dentro), closed (salida registrada), cancelled.
 */
const ticketSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'El vehículo es obligatorio'],
    },

    vehicleCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'VehicleCategory',
      required: [true, 'La categoría es obligatoria'],
    },

    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
    },

    rateId: {
      type: Schema.Types.ObjectId,
      ref: 'Rate',
      default: null,
    },

    rateSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },

    cashRegisterId: {
      type: Schema.Types.ObjectId,
      ref: 'CashRegister',
      required: [true, 'La sesión de caja es obligatoria'],
    },

    entryAt: {
      type: Date,
      required: [true, 'La fecha de ingreso es obligatoria'],
    },

    exitAt: {
      type: Date,
      default: null,
    },

    durationMinutes: {
      type: Number,
      min: [0, 'La duración no puede ser negativa'],
      default: null,
    },

    total: {
      type: Number,
      min: [0, 'El total no puede ser negativo'],
      default: 0,
    },

    calculationBreakdown: {
      type: Schema.Types.Mixed,
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: ['open', 'closed', 'cancelled'],
        message: 'Estado inválido: {VALUE}',
      },
      default: 'open',
      required: true,
    },

    coveredByMembership: {
      type: Boolean,
      default: false,
    },

    parkingMembershipId: {
      type: Schema.Types.ObjectId,
      ref: 'ParkingMembership',
      default: null,
    },

    entryUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario de ingreso es obligatorio'],
    },

    exitUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    /** Origen del ingreso — preparado para QR, LPR, barreras */
    entrySource: {
      type: String,
      enum: ['manual', 'qr', 'lpr', 'barrier', 'reentry'],
      default: 'manual',
    },

    /** Referencia externa (QR, cámara, barrera) */
    externalReference: {
      type: String,
      trim: true,
      maxlength: [200, 'La referencia no puede superar 200 caracteres'],
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
    collection: 'tickets',
  },
);

ticketSchema.index({ organizationId: 1, status: 1, entryAt: -1 });
ticketSchema.index({ organizationId: 1, createdAt: -1 });
ticketSchema.index({ organizationId: 1, vehicleId: 1, status: 1 });
ticketSchema.index({ organizationId: 1, memberId: 1 });
ticketSchema.index({ organizationId: 1, cashRegisterId: 1 });
ticketSchema.index({ organizationId: 1, status: 1, exitAt: -1 });
ticketSchema.index({ organizationId: 1, vehicleCategoryId: 1, status: 1 });
ticketSchema.index(
  { organizationId: 1, vehicleId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'open' },
    name: 'unique_open_ticket_per_vehicle',
  },
);

const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;
