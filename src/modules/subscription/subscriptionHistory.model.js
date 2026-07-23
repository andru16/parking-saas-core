import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Historial de cambios de plan / suscripción (upgrade, downgrade, etc.).
 */
const subscriptionHistorySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
    },
    fromPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
    },
    toPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
    },
    action: {
      type: String,
      enum: [
        'created',
        'upgraded',
        'downgraded',
        'renewed',
        'cancelled',
        'suspended',
        'reactivated',
        'trial_extended',
        'trial_ended',
        'trial_premium_started',
        'trial_premium_ended',
        'activation_requested',
        'activation_approved',
        'activation_rejected',
        'expired',
        'grace_started',
        'scheduled_change',
      ],
      required: true,
    },
    changeMode: {
      type: String,
      enum: ['immediate', 'scheduled', null],
      default: 'immediate',
    },
    billingCycle: {
      type: String,
      default: null,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000],
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'subscriptionHistory',
  },
);

subscriptionHistorySchema.index({ organizationId: 1, createdAt: -1 });
subscriptionHistorySchema.index({ subscriptionId: 1 });

const SubscriptionHistory = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);

export default SubscriptionHistory;
