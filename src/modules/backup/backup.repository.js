import BackupJob from './backupJob.model.js';
import { BACKUP_STATUSES } from './constants.js';

/**
 * BackupRepository — persistencia de jobs (sin lógica de negocio).
 */
export class BackupRepository {
  async create(doc) {
    return BackupJob.create(doc);
  }

  async findById(id) {
    return BackupJob.findById(id)
      .populate('triggeredByUserId', 'firstName lastName email')
      .populate('organizationId', 'name email status')
      .lean();
  }

  async findByIdForOrg(id, organizationId) {
    return BackupJob.findOne({ _id: id, organizationId })
      .populate('triggeredByUserId', 'firstName lastName email')
      .lean();
  }

  async updateById(id, patch) {
    return BackupJob.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  }

  async listByOrganization(organizationId, { page = 1, limit = 20, status } = {}) {
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const match = {
      organizationId,
      status: { $ne: BACKUP_STATUSES.DELETED },
    };
    if (status) match.status = status;

    const [items, total] = await Promise.all([
      BackupJob.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('triggeredByUserId', 'firstName lastName email')
        .lean(),
      BackupJob.countDocuments(match),
    ]);

    return {
      items,
      pagination: {
        page: Math.max(1, Number(page) || 1),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  async listAll({ page = 1, limit = 20, organizationId, status } = {}) {
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const match = { status: { $ne: BACKUP_STATUSES.DELETED } };
    if (organizationId) match.organizationId = organizationId;
    if (status) match.status = status;

    const [items, total] = await Promise.all([
      BackupJob.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('triggeredByUserId', 'firstName lastName email')
        .populate('organizationId', 'name email status')
        .lean(),
      BackupJob.countDocuments(match),
    ]);

    return {
      items,
      pagination: {
        page: Math.max(1, Number(page) || 1),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  async getLatestCompleted(organizationId) {
    return BackupJob.findOne({
      organizationId,
      status: BACKUP_STATUSES.COMPLETED,
    })
      .sort({ finishedAt: -1 })
      .lean();
  }

  async listCompletedForRetention(organizationId) {
    return BackupJob.find({
      organizationId,
      status: BACKUP_STATUSES.COMPLETED,
    })
      .sort({ finishedAt: -1 })
      .select('_id finishedAt expiresAt storageKey storageProvider sizeBytes')
      .lean();
  }

  async softDelete(id) {
    return BackupJob.findByIdAndUpdate(
      id,
      { $set: { status: BACKUP_STATUSES.DELETED } },
      { new: true },
    ).lean();
  }

  async countByStatus(organizationId) {
    const rows = await BackupJob.aggregate([
      {
        $match: {
          organizationId,
          status: { $ne: BACKUP_STATUSES.DELETED },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }
}

export const backupRepository = new BackupRepository();
