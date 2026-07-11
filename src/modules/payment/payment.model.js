import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Cobro o reverso vinculado a un Ticket.
 * Un Ticket puede tener cero, uno o múltiples pagos (pagos combinados).
 */
const paymentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: [true, 'El ticket es obligatorio'],
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El cajero es obligatorio'],
    },

    cashRegisterId: {
      type: Schema.Types.ObjectId,
      ref: 'CashRegister',
      required: [true, 'La caja es obligatoria'],
    },

    amount: {
      type: Number,
      required: [true, 'El monto es obligatorio'],
      min: [0, 'El monto no puede ser negativo'],
    },

    /** Código del método — validado contra Settings.paymentMethods */
    method: {
      type: String,
      required: [true, 'El método de pago es obligatorio'],
      trim: true,
      maxlength: [40, 'El método no puede superar 40 caracteres'],
    },

    kind: {
      type: String,
      enum: {
        values: ['charge', 'reversal'],
        message: 'Tipo inválido: {VALUE}',
      },
      default: 'charge',
      required: true,
    },

    status: {
      type: String,
      enum: {
        values: ['completed', 'refunded', 'cancelled'],
        message: 'Estado inválido: {VALUE}',
      },
      default: 'completed',
      required: true,
    },

    reversalOfId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },

    reversalReason: {
      type: String,
      trim: true,
      maxlength: [300, 'El motivo no puede superar 300 caracteres'],
      default: null,
    },

    reference: {
      type: String,
      trim: true,
      maxlength: [100, 'La referencia no puede superar 100 caracteres'],
    },

    paidAt: {
      type: Date,
      required: [true, 'La fecha de pago es obligatoria'],
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'payments',
  },
);

paymentSchema.index({ organizationId: 1, paidAt: -1 });
paymentSchema.index({ organizationId: 1, kind: 1, status: 1, paidAt: -1 });
paymentSchema.index({ organizationId: 1, method: 1 });
paymentSchema.index({ organizationId: 1, status: 1 });
paymentSchema.index({ ticketId: 1 });
paymentSchema.index({ cashRegisterId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ reversalOfId: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
