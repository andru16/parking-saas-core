import mongoose from 'mongoose';
import {
  SUPPORT_AUTHOR_TYPES,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from './constants.js';

const { Schema } = mongoose;

const supportMessageSchema = new Schema(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'SupportTicket',
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    authorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    authorType: {
      type: String,
      enum: Object.values(SUPPORT_AUTHOR_TYPES),
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: [5000, 'El mensaje no puede superar 5000 caracteres'],
    },
    /** Prep. adjuntos — no implementado aún */
    attachments: {
      type: [
        {
          filename: String,
          mimeType: String,
          sizeBytes: Number,
          storageKey: String,
          uploadedAt: Date,
        },
      ],
      default: [],
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'supportMessages',
  },
);

supportMessageSchema.index({ ticketId: 1, createdAt: 1 });

const supportTicketSchema = new Schema(
  {
    number: {
      type: Number,
      required: true,
      unique: true,
    },
    numberLabel: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subject: {
      type: String,
      required: [true, 'El asunto es obligatorio'],
      trim: true,
      maxlength: [200, 'El asunto no puede superar 200 caracteres'],
    },
    description: {
      type: String,
      required: [true, 'La descripción es obligatoria'],
      trim: true,
      maxlength: [5000, 'La descripción no puede superar 5000 caracteres'],
    },
    category: {
      type: String,
      enum: Object.values(SUPPORT_CATEGORIES),
      required: true,
      default: SUPPORT_CATEGORIES.OTHER,
    },
    priority: {
      type: String,
      enum: Object.values(SUPPORT_PRIORITIES),
      required: true,
      default: SUPPORT_PRIORITIES.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(SUPPORT_STATUSES),
      required: true,
      default: SUPPORT_STATUSES.OPEN,
      index: true,
    },
    /** Prep. asignación a agente de plataforma */
    assignedToUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    closedAt: { type: Date, default: null },
    closedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    lastMessageAt: { type: Date, default: null },
    messageCount: { type: Number, default: 0 },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'supportTickets',
  },
);

supportTicketSchema.index({ organizationId: 1, createdAt: -1 });
supportTicketSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
supportTicketSchema.index({ subject: 'text', description: 'text', numberLabel: 'text' });

const SupportCounterSchema = new Schema(
  {
    key: { type: String, unique: true, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: 'supportCounters' },
);

export const SupportCounter = mongoose.model('SupportCounter', SupportCounterSchema);
export const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);
const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

export default SupportTicket;
