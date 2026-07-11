import mongoose from 'mongoose';
import {
  PRINT_ADAPTERS,
  PRINT_DOCUMENT_TYPES,
  PRINT_FORMATS,
  PRINT_JOB_STATUSES,
  PRINT_RESOURCE_TYPES,
} from '#services/printing/constants.js';

const { Schema } = mongoose;

/**
 * Historial de impresiones (PrintJobs).
 * No envía a impresora física; registra cada render/reimpresión.
 */
const printJobSchema = new Schema(
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
      default: null,
    },
    documentType: {
      type: String,
      required: true,
      enum: Object.values(PRINT_DOCUMENT_TYPES),
    },
    resourceType: {
      type: String,
      required: true,
      enum: Object.values(PRINT_RESOURCE_TYPES),
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    format: {
      type: String,
      enum: Object.values(PRINT_FORMATS),
      default: PRINT_FORMATS.HTML,
    },
    adapter: {
      type: String,
      enum: Object.values(PRINT_ADAPTERS),
      default: PRINT_ADAPTERS.BROWSER,
    },
    status: {
      type: String,
      enum: Object.values(PRINT_JOB_STATUSES),
      default: PRINT_JOB_STATUSES.RENDERED,
    },
    isReprint: {
      type: Boolean,
      default: false,
    },
    reprintReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    paperSize: {
      type: String,
      enum: ['58mm', '80mm', 'A4'],
      default: '80mm',
    },
    copies: {
      type: Number,
      min: 1,
      max: 5,
      default: 1,
    },
    documentNumber: {
      type: String,
      trim: true,
      default: null,
    },
    /** Snapshot ligero del documento (sin HTML completo) */
    snapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'printJobs',
  },
);

printJobSchema.index({ organizationId: 1, createdAt: -1 });
printJobSchema.index({ organizationId: 1, resourceType: 1, resourceId: 1 });
printJobSchema.index({ organizationId: 1, documentType: 1, createdAt: -1 });

const PrintJob = mongoose.model('PrintJob', printJobSchema);

export default PrintJob;
