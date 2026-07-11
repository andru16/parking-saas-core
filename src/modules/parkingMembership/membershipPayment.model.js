import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Pago de membresía / mensualidad (distinto de pagos de ticket).
 */
const membershipPaymentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    parkingMembershipId: {
      type: Schema.Types.ObjectId,
      ref: 'ParkingMembership',
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'El monto no puede ser negativo'],
    },
    method: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    receivedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paidAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    /** new | renewal | other */
    kind: {
      type: String,
      enum: ['new', 'renewal', 'other'],
      default: 'renewal',
    },
  },
  {
    timestamps: true,
    collection: 'membershipPayments',
  },
);

membershipPaymentSchema.index({ organizationId: 1, paidAt: -1 });
membershipPaymentSchema.index({ organizationId: 1, memberId: 1, paidAt: -1 });
membershipPaymentSchema.index({ organizationId: 1, parkingMembershipId: 1 });

const MembershipPayment = mongoose.model('MembershipPayment', membershipPaymentSchema);

export default MembershipPayment;
