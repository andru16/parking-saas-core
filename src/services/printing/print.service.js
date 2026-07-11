import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import {
  PRINT_ADAPTERS,
  PRINT_AUDIT_ACTIONS,
  PRINT_DOCUMENT_TYPES,
  PRINT_FORMATS,
  normalizeDocumentType,
} from './constants.js';
import { printSettingsService } from './printSettings.service.js';
import { printDocumentFactory } from './printDocument.factory.js';
import { printJobService } from './printJob.service.js';
import { listAdapters, renderWithAdapter } from './adapters/adapter.registry.js';

/**
 * PrintService — orquestador del Motor de Impresión.
 * Desacoplado de Tickets/Caja: solo recibe IDs y tipo de documento.
 */
export class PrintService {
  async getConfig(organizationId) {
    return printSettingsService.getConfig(organizationId);
  }

  listAdapters() {
    return listAdapters();
  }

  async getTicketDocument(
    organizationId,
    ticketId,
    { type = 'auto', format = PRINT_FORMATS.HTML, adapter, userId = null, recordJob = true } = {},
  ) {
    const document = await printDocumentFactory.buildTicket(organizationId, ticketId, type);
    return this.#finalize(organizationId, document, {
      format,
      adapter,
      userId,
      recordJob,
    });
  }

  async getCashDocument(
    organizationId,
    cashRegisterId,
    {
      type = PRINT_DOCUMENT_TYPES.CASH_CLOSE,
      format = PRINT_FORMATS.HTML,
      adapter,
      summary = null,
      userId = null,
      recordJob = true,
    } = {},
  ) {
    const document = await printDocumentFactory.buildCash(
      organizationId,
      cashRegisterId,
      type,
      summary,
    );
    return this.#finalize(organizationId, document, {
      format,
      adapter,
      userId,
      recordJob,
    });
  }

  async getMembershipDocument(
    organizationId,
    membershipId,
    {
      type = PRINT_DOCUMENT_TYPES.MEMBERSHIP_PAYMENT,
      format = PRINT_FORMATS.HTML,
      adapter,
      userId = null,
      operator = null,
      recordJob = true,
    } = {},
  ) {
    const document = await printDocumentFactory.buildMembership(
      organizationId,
      membershipId,
      type,
      operator,
    );
    return this.#finalize(organizationId, document, {
      format,
      adapter,
      userId,
      recordJob,
    });
  }

  async getPaymentDocument(
    organizationId,
    paymentId,
    { format = PRINT_FORMATS.HTML, adapter, userId = null, recordJob = true } = {},
  ) {
    const document = await printDocumentFactory.buildPaymentReceipt(
      organizationId,
      paymentId,
    );
    return this.#finalize(organizationId, document, {
      format,
      adapter,
      userId,
      recordJob,
    });
  }

  async getPreview(
    organizationId,
    { type = 'entry', draft, format = PRINT_FORMATS.HTML, adapter } = {},
  ) {
    const document = await printDocumentFactory.buildPreview(organizationId, {
      type,
      draft,
    });
    return this.#finalize(organizationId, document, {
      format,
      adapter,
      recordJob: false,
    });
  }

  /**
   * Reimpresión genérica con auditoría + PrintJob.
   */
  async reprint(organizationId, userId, payload, auditContext = {}) {
    const reason = String(payload.reason ?? '').trim();
    if (!reason) {
      throw new ApiError(400, 'El motivo de reimpresión es obligatorio');
    }

    const format = payload.format ?? PRINT_FORMATS.HTML;
    const adapter = payload.adapter;
    let result;

    if (payload.ticketId) {
      result = await this.getTicketDocument(organizationId, payload.ticketId, {
        type: payload.type ?? 'auto',
        format,
        adapter,
        userId,
        recordJob: false,
      });
    } else if (payload.cashRegisterId) {
      result = await this.getCashDocument(organizationId, payload.cashRegisterId, {
        type: payload.type ?? PRINT_DOCUMENT_TYPES.CASH_CLOSE,
        format,
        adapter,
        userId,
        recordJob: false,
      });
    } else if (payload.membershipId) {
      result = await this.getMembershipDocument(organizationId, payload.membershipId, {
        type: payload.type ?? PRINT_DOCUMENT_TYPES.MEMBERSHIP_PAYMENT,
        format,
        adapter,
        userId,
        recordJob: false,
      });
    } else if (payload.paymentId) {
      result = await this.getPaymentDocument(organizationId, payload.paymentId, {
        format,
        adapter,
        userId,
        recordJob: false,
      });
    } else {
      throw new ApiError(400, 'Indique ticketId, cashRegisterId, membershipId o paymentId');
    }

    const job = await printJobService.record({
      organizationId,
      userId,
      document: result.document,
      format: result.format,
      adapter: result.adapter || PRINT_ADAPTERS.BROWSER,
      isReprint: true,
      reprintReason: reason,
    });

    const isTicket = Boolean(payload.ticketId);
    await auditService.log({
      userId,
      organizationId,
      module: 'printing',
      action: isTicket ? PRINT_AUDIT_ACTIONS.TICKET_REPRINT : PRINT_AUDIT_ACTIONS.REPRINT,
      description: `Reimpresión: ${result.document.meta.typeLabel || result.document.meta.type}`,
      resourceId: result.document.meta.resourceId,
      entityType: result.document.meta.resourceType,
      entityId: result.document.meta.resourceId,
      ip: auditContext.ip ?? null,
      userAgent: auditContext.userAgent ?? null,
      metadata: {
        documentType: result.document.meta.type,
        documentNumber: result.document.meta.documentNumber,
        format,
        reason,
        printJobId: job.id,
        reprintedAt: new Date().toISOString(),
      },
    });

    return {
      ...result,
      job,
      reprint: {
        reason,
        reprintedAt: new Date().toISOString(),
      },
    };
  }

  /** Compat: reprint solo de ticket */
  async reprintTicket(organizationId, userId, ticketId, payload, auditContext = {}) {
    return this.reprint(
      organizationId,
      userId,
      { ...payload, ticketId },
      auditContext,
    );
  }

  async listJobs(organizationId, query = {}) {
    return printJobService.list(organizationId, query);
  }

  async #finalize(
    organizationId,
    document,
    { format = PRINT_FORMATS.HTML, adapter, userId = null, recordJob = true } = {},
  ) {
    const rendered = await renderWithAdapter(document, { format, adapter });
    let job = null;

    if (recordJob && !document.meta.isPreview) {
      job = await printJobService.record({
        organizationId,
        userId,
        document,
        format: rendered.format,
        adapter: rendered.adapter || adapter || PRINT_ADAPTERS.BROWSER,
      });
    }

    return {
      ...rendered,
      job,
    };
  }
}

export const printService = new PrintService();

export { normalizeDocumentType };
