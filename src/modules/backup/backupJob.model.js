import mongoose from 'mongoose';
import {
  BACKUP_STATUSES,
  BACKUP_TYPES,
  RESTORE_STATUSES,
  STORAGE_PROVIDERS,
} from './constants.js';

const { Schema } = mongoose;

/**
 * Historial de backups / restauraciones por organización.
 */
const backupJobSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(BACKUP_TYPES),
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(BACKUP_STATUSES),
      default: BACKUP_STATUSES.PENDING,
      required: true,
    },

    triggeredByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    /** 'user' | 'scheduler' | 'super_admin' | 'system' */
    triggeredBy: {
      type: String,
      enum: ['user', 'scheduler', 'super_admin', 'system'],
      default: 'user',
    },

    storageProvider: {
      type: String,
      enum: Object.values(STORAGE_PROVIDERS),
      default: STORAGE_PROVIDERS.LOCAL,
    },

    /** Ruta / key relativa en el provider */
    storageKey: {
      type: String,
      trim: true,
      default: null,
    },

    filename: {
      type: String,
      trim: true,
      default: null,
    },

    sizeBytes: {
      type: Number,
      min: 0,
      default: 0,
    },

    checksumSha256: {
      type: String,
      trim: true,
      default: null,
    },

    formatVersion: {
      type: Number,
      default: 1,
    },

    /** Prep. incrementales / cifrado / parcial */
    strategy: {
      mode: {
        type: String,
        enum: ['full', 'incremental'],
        default: 'full',
      },
      compressed: { type: Boolean, default: true },
      encrypted: { type: Boolean, default: false },
      partial: { type: Boolean, default: false },
      parentBackupId: {
        type: Schema.Types.ObjectId,
        ref: 'BackupJob',
        default: null,
      },
    },

    collections: {
      type: [
        {
          name: String,
          documentCount: { type: Number, default: 0 },
        },
      ],
      default: [],
    },

    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },

    resultMessage: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    errorMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    restore: {
      status: {
        type: String,
        enum: Object.values(RESTORE_STATUSES),
        default: RESTORE_STATUSES.NONE,
      },
      requestedAt: { type: Date, default: null },
      requestedByUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      confirmedAt: { type: Date, default: null },
      finishedAt: { type: Date, default: null },
      message: { type: String, trim: true, default: null },
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'backupJobs',
  },
);

backupJobSchema.index({ organizationId: 1, createdAt: -1 });
backupJobSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
backupJobSchema.index({ status: 1, type: 1, createdAt: -1 });
backupJobSchema.index({ expiresAt: 1 }, { sparse: true });

const BackupJob = mongoose.model('BackupJob', backupJobSchema);

export default BackupJob;
