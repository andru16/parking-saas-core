import PrintJob from '#modules/printing/printJob.model.js';
import { PRINT_JOB_STATUSES } from './constants.js';

/**
 * Historial de PrintJobs.
 */
export class PrintJobService {
  async record({
    organizationId,
    userId = null,
    document,
    format,
    adapter,
    isReprint = false,
    reprintReason = null,
    status = PRINT_JOB_STATUSES.RENDERED,
  }) {
    const job = await PrintJob.create({
      organizationId,
      userId,
      documentType: document.meta.type,
      resourceType: document.meta.resourceType,
      resourceId: document.meta.resourceId,
      format,
      adapter: adapter || document.meta.preferredAdapter || 'browser',
      status: isReprint ? PRINT_JOB_STATUSES.REPRINTED : status,
      isReprint,
      reprintReason,
      paperSize: document.meta.paperSize,
      copies: document.meta.copies,
      documentNumber: document.meta.documentNumber || document.meta.ticketNumber,
      snapshot: {
        typeLabel: document.meta.typeLabel,
        lines: (document.lines || []).slice(0, 20),
        generatedAt: document.meta.generatedAt,
      },
    });

    return this.#toResponse(job);
  }

  async list(organizationId, { page = 1, limit = 30, resourceType, resourceId } = {}) {
    const filter = { organizationId };
    if (resourceType) filter.resourceType = resourceType;
    if (resourceId) filter.resourceId = resourceId;

    const skip = (Math.max(1, page) - 1) * limit;
    const [items, total] = await Promise.all([
      PrintJob.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.min(100, limit))
        .populate('userId', 'firstName lastName email')
        .lean(),
      PrintJob.countDocuments(filter),
    ]);

    return {
      items: items.map((j) => this.#toResponse(j)),
      pagination: {
        page: Math.max(1, page),
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  #toResponse(job) {
    const doc = job.toObject ? job.toObject() : job;
    return {
      id: String(doc._id),
      documentType: doc.documentType,
      resourceType: doc.resourceType,
      resourceId: doc.resourceId ? String(doc.resourceId) : null,
      format: doc.format,
      adapter: doc.adapter,
      status: doc.status,
      isReprint: Boolean(doc.isReprint),
      reprintReason: doc.reprintReason ?? null,
      paperSize: doc.paperSize,
      copies: doc.copies,
      documentNumber: doc.documentNumber ?? null,
      snapshot: doc.snapshot ?? null,
      user: doc.userId
        ? {
            id: String(doc.userId._id || doc.userId),
            name:
              doc.userId.firstName != null
                ? `${doc.userId.firstName} ${doc.userId.lastName || ''}`.trim()
                : null,
            email: doc.userId.email ?? null,
          }
        : null,
      createdAt: doc.createdAt,
    };
  }
}

export const printJobService = new PrintJobService();
