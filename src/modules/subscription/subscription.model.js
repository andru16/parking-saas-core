import mongoose from 'mongoose';

const { Schema } = mongoose;

export const SUBSCRIPTION_STATUSES = Object.freeze([
  'trial',
  'active',
  'grace_period',
  'expired',
  'suspended',
  'cancelled',
]);

export const BILLING_CYCLES = Object.freeze([
  'trial',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
]);

/** Estados con acceso operativo completo (incluye período de gracia). */
export const OPERATIONAL_SUBSCRIPTION_STATUSES = Object.freeze([
  'trial',
  'active',
  'grace_period',
]);
/**
 * Suscripción SaaS de una Organization.
 * Historial: cada cambio crea/cierra documentos; no se borra.
 */
const subscriptionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'El plan es obligatorio'],
    },

    billingCycle: {
      type: String,
      enum: {
        values: BILLING_CYCLES,
        message: 'Tipo de cobro inválido: {VALUE}',
      },
      required: true,
      default: 'monthly',
    },

    startDate: {
      type: Date,
      required: [true, 'La fecha de inicio es obligatoria'],
    },

    endDate: {
      type: Date,
      required: [true, 'La fecha de vencimiento es obligatoria'],
    },

    status: {
      type: String,
      enum: {
        values: SUBSCRIPTION_STATUSES,
        message: 'Estado inválido: {VALUE}',
      },
      default: 'active',
      required: true,
    },

    autoRenewal: {
      type: Boolean,
      default: false,
    },

    /** Fin del período de gracia (solo cuando status = grace_period). */
    gracePeriodEndsAt: {
      type: Date,
      default: null,
    },

    /**
     * Recordatorios ya enviados por el motor (evita duplicados diarios).
     * Ej: [{ key: 'trial_7d', sentAt }]
     */
    remindersSent: {
      type: [
        {
          key: { type: String, required: true },
          sentAt: { type: Date, required: true },
        },
      ],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Las observaciones no pueden superar 1000 caracteres'],
      default: '',
    },

    /** Cambio programado (preparado) */
    scheduledPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
    },
    scheduledBillingCycle: {
      type: String,
      enum: {
        values: BILLING_CYCLES,
        message: 'Ciclo programado inválido',
      },
      default: undefined,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    changeMode: {
      type: String,
      enum: {
        values: ['immediate', 'scheduled'],
        message: 'Modo de cambio inválido',
      },
      default: undefined,
    },

    paymentMethod: {
      type: String,
      enum: {
        values: ['none', 'cash', 'card', 'transfer', 'nequi', 'daviplata', 'other', 'gateway'],
        message: 'Método de pago inválido: {VALUE}',
      },
      default: 'none',
    },

    amountPaid: {
      type: Number,
      min: [0, 'El monto pagado no puede ser negativo'],
      default: 0,
    },

    paymentReference: {
      type: String,
      trim: true,
      maxlength: [100, 'La referencia no puede superar 100 caracteres'],
      default: null,
    },

    /** Prep. pasarelas: Stripe / Mercado Pago / Wompi / PayU */
    billingProvider: {
      type: String,
      enum: {
        values: ['none', 'stripe', 'mercadopago', 'wompi', 'payu', 'manual'],
        message: 'Proveedor de billing inválido',
      },
      default: 'none',
    },
    externalCustomerId: { type: String, trim: true, default: null },
    externalSubscriptionId: { type: String, trim: true, default: null },

    /** Prep. facturación electrónica */
    invoiceStatus: {
      type: String,
      enum: ['none', 'pending', 'issued', 'failed'],
      default: 'none',
    },
  },
  {
    timestamps: true,
    collection: 'subscriptions',
  },
);

subscriptionSchema.index({ organizationId: 1, status: 1, endDate: -1 });
subscriptionSchema.index({ organizationId: 1, createdAt: -1 });
subscriptionSchema.index({ planId: 1 });
subscriptionSchema.index({ scheduledAt: 1 }, { sparse: true });
subscriptionSchema.index({ status: 1, endDate: 1 });
subscriptionSchema.index({ status: 1, gracePeriodEndsAt: 1 });

subscriptionSchema.pre('validate', function assertDates() {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    throw new Error('La fecha de fin no puede ser anterior a la de inicio');
  }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
