import SupportTicket, { SupportCounter, SupportMessage } from './supportTicket.model.js';
import { SUPPORT_STATUSES } from './constants.js';

/**
 * SupportRepository — persistencia de tickets y mensajes de soporte.
 */
export class SupportRepository {
  async nextNumber() {
    const counter = await SupportCounter.findOneAndUpdate(
      { key: 'support_ticket' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );
    return counter.seq;
  }

  async createTicket(doc) {
    return SupportTicket.create(doc);
  }

  async findTicketById(id) {
    return SupportTicket.findById(id)
      .populate('createdByUserId', 'firstName lastName email')
      .populate('assignedToUserId', 'firstName lastName email')
      .populate('organizationId', 'name email status')
      .populate('closedByUserId', 'firstName lastName email')
      .lean();
  }

  async findTicketForOrg(id, organizationId) {
    return SupportTicket.findOne({ _id: id, organizationId })
      .populate('createdByUserId', 'firstName lastName email')
      .populate('assignedToUserId', 'firstName lastName email')
      .populate('closedByUserId', 'firstName lastName email')
      .lean();
  }

  async updateTicket(id, patch) {
    return SupportTicket.findByIdAndUpdate(id, { $set: patch }, { new: true })
      .populate('createdByUserId', 'firstName lastName email')
      .populate('assignedToUserId', 'firstName lastName email')
      .populate('organizationId', 'name email status')
      .lean();
  }

  async list({
    organizationId,
    status,
    priority,
    category,
    search,
    page = 1,
    limit = 20,
  } = {}) {
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const match = {};

    if (organizationId) match.organizationId = organizationId;
    if (status) match.status = status;
    if (priority) match.priority = priority;
    if (category) match.category = category;
    if (search?.trim()) {
      const s = search.trim();
      match.$or = [
        { numberLabel: { $regex: s, $options: 'i' } },
        { subject: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      SupportTicket.find(match)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('createdByUserId', 'firstName lastName email')
        .populate('organizationId', 'name email status')
        .populate('assignedToUserId', 'firstName lastName email')
        .lean(),
      SupportTicket.countDocuments(match),
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

  async createMessage(doc) {
    return SupportMessage.create(doc);
  }

  async listMessages(ticketId, { includeInternal = false } = {}) {
    const match = { ticketId };
    if (!includeInternal) match.isInternal = { $ne: true };

    return SupportMessage.find(match)
      .sort({ createdAt: 1 })
      .populate('authorUserId', 'firstName lastName email')
      .lean();
  }

  async getMetrics() {
    const openStatuses = [
      SUPPORT_STATUSES.OPEN,
      SUPPORT_STATUSES.IN_PROGRESS,
      SUPPORT_STATUSES.WAITING_CUSTOMER,
    ];

    const [byStatus, byCategory, byOrg, responseAgg, resolutionAgg] = await Promise.all([
      SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      SupportTicket.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      SupportTicket.aggregate([
        { $group: { _id: '$organizationId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'organizations',
            localField: '_id',
            foreignField: '_id',
            as: 'org',
          },
        },
        { $unwind: { path: '$org', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            organizationId: '$_id',
            name: '$org.name',
            count: 1,
          },
        },
      ]),
      SupportTicket.aggregate([
        { $match: { firstResponseAt: { $ne: null } } },
        {
          $project: {
            ms: { $subtract: ['$firstResponseAt', '$createdAt'] },
          },
        },
        { $group: { _id: null, avgMs: { $avg: '$ms' }, count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        {
          $match: {
            resolvedAt: { $ne: null },
            status: { $in: [SUPPORT_STATUSES.RESOLVED, SUPPORT_STATUSES.CLOSED] },
          },
        },
        {
          $project: {
            ms: { $subtract: ['$resolvedAt', '$createdAt'] },
          },
        },
        { $group: { _id: null, avgMs: { $avg: '$ms' }, count: { $sum: 1 } } },
      ]),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
    const openCount = openStatuses.reduce((sum, s) => sum + (statusMap[s] || 0), 0);
    const closedCount =
      (statusMap[SUPPORT_STATUSES.CLOSED] || 0) + (statusMap[SUPPORT_STATUSES.RESOLVED] || 0);

    return {
      open: openCount,
      closed: closedCount,
      byStatus: statusMap,
      byCategory: Object.fromEntries(byCategory.map((r) => [r._id, r.count])),
      byOrganization: byOrg,
      avgFirstResponseMs: responseAgg[0]?.avgMs ?? null,
      avgResolutionMs: resolutionAgg[0]?.avgMs ?? null,
      avgFirstResponseSamples: responseAgg[0]?.count ?? 0,
      avgResolutionSamples: resolutionAgg[0]?.count ?? 0,
    };
  }
}

export const supportRepository = new SupportRepository();
