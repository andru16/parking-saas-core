import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ACTIVATION_REQUEST_STATUSES = Object.freeze([
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
]);

/**
 * Solicitud manual de activación de suscripción (pre-pasarela de pago).
 * Preparado para evolucionar a checkout automatizado sin rehacer el flujo.
 */
const subscriptionActivationRequestSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    contactName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    dailyVehicles: {
      type: Number,
      min: 0,
      default: null,
    },
    branches: {
      type: Number,
      min: 1,
      default: 1,
    },
    schedule: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    comments: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ACTIVATION_REQUEST_STATUSES,
        message: 'Estado inválido: {VALUE}',
      },
      default: 'PENDING',
      required: true,
      index: true,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
    reviewedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    activationStartDate: {
      type: Date,
      default: null,
    },
    activationEndDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'subscriptionActivationRequests',
  },
);

subscriptionActivationRequestSchema.index({ createdAt: -1 });
subscriptionActivationRequestSchema.index({ organizationId: 1, status: 1 });

const SubscriptionActivationRequest = mongoose.model(
  'SubscriptionActivationRequest',
  subscriptionActivationRequestSchema,
);

export default SubscriptionActivationRequest;
