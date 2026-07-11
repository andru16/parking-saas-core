import mongoose from 'mongoose';
import {
  BILLING_CYCLE_DAYS,
  BILLING_CYCLE_LABELS,
  billingCyclesFromPricing,
  pricingFromBillingCycles,
} from '#services/saas-billing/billingCycles.js';

const { Schema } = mongoose;

const limitsSchema = new Schema(
  {
    maxUsers: { type: Number, min: 0, default: null },
    maxCashRegisters: { type: Number, min: 0, default: null },
    /** Multi-sede (prep.): null = ilimitado */
    maxSites: { type: Number, min: 0, default: null },
    /** No limitar operación: null = sin tope */
    maxActiveVehicles: { type: Number, min: 0, default: null },
    maxDailyTickets: { type: Number, min: 0, default: null },
  },
  { _id: false },
);

/** Precios planos (compat + MRR). Fuente de verdad sincronizada con billingCycles. */
const pricingSchema = new Schema(
  {
    monthly: { type: Number, min: 0, default: 0 },
    quarterly: { type: Number, min: 0, default: 0 },
    semiannual: { type: Number, min: 0, default: 0 },
    annual: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

/**
 * Ciclos de facturación del plan (modalidades de pago).
 * No confundir con el plan comercial (Trial / Starter / …).
 */
const billingCycleSchema = new Schema(
  {
    cycle: {
      type: String,
      enum: ['trial', 'monthly', 'quarterly', 'semiannual', 'annual'],
      required: true,
    },
    label: { type: String, trim: true, maxlength: 40, default: '' },
    price: { type: Number, min: 0, default: 0 },
    durationDays: { type: Number, min: 1, default: null },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const iconSchema = new Schema(
  {
    name: { type: String, trim: true, default: null },
    url: { type: String, trim: true, default: null },
  },
  { _id: false },
);

/**
 * Plan comercial del SaaS (Trial | Starter | Professional | Enterprise).
 * Los ciclos Mensual/Trimestral/… viven en `billingCycles`, no como planes.
 */
const planSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del plan es obligatorio'],
      unique: true,
      trim: true,
      maxlength: [80, 'El nombre no puede superar 80 caracteres'],
    },

    code: {
      type: String,
      required: [true, 'El código del plan es obligatorio'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [40, 'El código no puede superar 40 caracteres'],
      match: [/^[a-z0-9_-]+$/, 'Código inválido (use a-z, 0-9, _ o -)'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'La descripción no puede superar 1000 caracteres'],
      default: '',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isTrialPlan: {
      type: Boolean,
      default: false,
    },

    /** Plan destacado en UI (p. ej. Professional) */
    isRecommended: {
      type: Boolean,
      default: false,
    },

    pricing: {
      type: pricingSchema,
      default: () => ({}),
    },

    billingCycles: {
      type: [billingCycleSchema],
      default: [],
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [3, 'Moneda ISO-4217'],
      default: 'COP',
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    color: {
      type: String,
      trim: true,
      maxlength: [30, 'Color inválido'],
      default: '#0f766e',
    },

    icon: {
      type: iconSchema,
      default: () => ({}),
    },

    limits: {
      type: limitsSchema,
      default: () => ({}),
    },

    features: {
      type: Map,
      of: Boolean,
      default: () => new Map(),
    },

    defaultDurationDays: {
      type: Number,
      min: [1, 'La duración debe ser al menos 1 día'],
      default: 30,
    },

    /** @deprecated Compat: alias de pricing.monthly */
    price: {
      type: Number,
      min: 0,
      default: 0,
    },

    /** @deprecated Compat */
    durationDays: {
      type: Number,
      min: 1,
      default: 30,
    },
  },
  {
    timestamps: true,
    collection: 'plans',
  },
);

planSchema.index({ isActive: 1, sortOrder: 1 });
planSchema.index({ isTrialPlan: 1 });
planSchema.index({ isRecommended: 1 });

planSchema.pre('validate', function syncPricingAndCycles() {
  // Si vienen billingCycles, sincronizan pricing.
  if (Array.isArray(this.billingCycles) && this.billingCycles.length > 0) {
    const fromCycles = pricingFromBillingCycles(this.billingCycles);
    this.pricing = {
      monthly: fromCycles.monthly,
      quarterly: fromCycles.quarterly,
      semiannual: fromCycles.semiannual,
      annual: fromCycles.annual,
    };
  } else if (this.pricing) {
    // Si solo hay pricing, materializa billingCycles.
    this.billingCycles = billingCyclesFromPricing(this.pricing, {
      includeTrial: Boolean(this.isTrialPlan),
    }).map((c) => ({
      ...c,
      label: c.label || BILLING_CYCLE_LABELS[c.cycle] || c.cycle,
      durationDays: c.durationDays ?? BILLING_CYCLE_DAYS[c.cycle] ?? null,
    }));
  }

  if (this.pricing?.monthly != null) {
    this.price = this.pricing.monthly;
  }
  if (this.defaultDurationDays) {
    this.durationDays = this.defaultDurationDays;
  }
});

const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);

export default Plan;
