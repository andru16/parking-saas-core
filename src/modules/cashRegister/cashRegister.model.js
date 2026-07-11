import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Sesión de caja de un cajero (apertura → cierre con conciliación).
 * Todo Payment debe pertenecer a una CashRegister.
 */
const cashRegisterSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    cashPointId: {
      type: Schema.Types.ObjectId,
      ref: 'CashPoint',
      required: [true, 'El punto de caja es obligatorio'],
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El cajero es obligatorio'],
    },

    openedAt: {
      type: Date,
      required: [true, 'La fecha de apertura es obligatoria'],
      default: Date.now,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    openingAmount: {
      type: Number,
      required: [true, 'El monto inicial es obligatorio'],
      min: [0, 'El monto inicial no puede ser negativo'],
      default: 0,
    },

    openingNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Las observaciones no pueden superar 500 caracteres'],
      default: null,
    },

    closingAmount: {
      type: Number,
      min: [0, 'El monto final no puede ser negativo'],
      default: null,
    },

    calculatedAmount: {
      type: Number,
      min: [0, 'El monto calculado no puede ser negativo'],
      default: 0,
    },

    difference: {
      type: Number,
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: ['open', 'closed'],
        message: 'Estado inválido: {VALUE}',
      },
      default: 'open',
      required: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Las observaciones no pueden superar 500 caracteres'],
    },

    closingSummary: {
      totalCollected: { type: Number, default: 0 },
      totalsByMethod: {
        type: Map,
        of: Number,
        default: () => new Map(),
      },
      ticketsPaid: { type: Number, default: 0 },
      ticketsMembership: { type: Number, default: 0 },
      ticketsFree: { type: Number, default: 0 },
      ticketsClosed: { type: Number, default: 0 },
      incomeByHour: {
        type: [
          {
            hour: { type: String, required: true },
            total: { type: Number, default: 0 },
          },
        ],
        default: [],
      },
    },
  },
  {
    timestamps: true,
    collection: 'cashRegisters',
  },
);

cashRegisterSchema.index({ organizationId: 1, status: 1 });
cashRegisterSchema.index({ organizationId: 1, openedAt: -1 });
cashRegisterSchema.index({ organizationId: 1, userId: 1, status: 1 });
cashRegisterSchema.index(
  { organizationId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'open' },
    name: 'unique_open_register_per_user',
  },
);
cashRegisterSchema.index(
  { organizationId: 1, cashPointId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'open' },
    name: 'unique_open_register_per_cash_point',
  },
);

const CashRegister = mongoose.model('CashRegister', cashRegisterSchema);

export default CashRegister;
