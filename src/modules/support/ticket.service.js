import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { supportRepository } from './support.repository.js';
import { supportNotifications } from './support.notifications.js';
import {
  SUPPORT_AUDIT_ACTIONS,
  SUPPORT_AUTHOR_TYPES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from './constants.js';

/**
 * TicketService (Support) — ciclo de vida de tickets de help desk.
 * No confundir con tickets de estacionamiento (`modules/ticket`).
 */
export class TicketService {
  async create({
    organizationId,
    userId,
    subject,
    description,
    category,
    priority = SUPPORT_PRIORITIES.MEDIUM,
    auditContext = {},
  }) {
    const seq = await supportRepository.nextNumber();
    const numberLabel = `SUP-${String(seq).padStart(5, '0')}`;

    const ticket = await supportRepository.createTicket({
      number: seq,
      numberLabel,
      organizationId,
      createdByUserId: userId,
      subject: subject.trim(),
      description: description.trim(),
      category,
      priority,
      status: SUPPORT_STATUSES.OPEN,
      lastMessageAt: new Date(),
      messageCount: 1,
    });

    await supportRepository.createMessage({
      ticketId: ticket._id,
      organizationId,
      authorUserId: userId,
      authorType: SUPPORT_AUTHOR_TYPES.ORGANIZATION_USER,
      body: description.trim(),
    });

    await auditService.log({
      userId,
      organizationId,
      module: 'support',
      action: SUPPORT_AUDIT_ACTIONS.CREATED,
      description: `Ticket de soporte creado: ${numberLabel}`,
      entityType: 'support_ticket',
      entityId: ticket._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { category, priority },
    });

    await supportNotifications.ticketCreated({
      organizationId,
      ticket,
      actorUserId: userId,
    });

    return supportRepository.findTicketById(ticket._id);
  }

  async getForOrganization(ticketId, organizationId) {
    const ticket = await supportRepository.findTicketForOrg(ticketId, organizationId);
    if (!ticket) throw new ApiError(404, 'Ticket de soporte no encontrado');
    return ticket;
  }

  async getById(ticketId) {
    const ticket = await supportRepository.findTicketById(ticketId);
    if (!ticket) throw new ApiError(404, 'Ticket de soporte no encontrado');
    return ticket;
  }

  async listForOrganization(organizationId, filters) {
    return supportRepository.list({ ...filters, organizationId });
  }

  async listAll(filters) {
    return supportRepository.list(filters);
  }

  async getConversation(ticketId, { includeInternal = false } = {}) {
    return supportRepository.listMessages(ticketId, { includeInternal });
  }

  async reply({
    ticketId,
    organizationId = null,
    userId,
    body,
    authorType,
    isInternal = false,
    auditContext = {},
  }) {
    const ticket = organizationId
      ? await this.getForOrganization(ticketId, organizationId)
      : await this.getById(ticketId);

    if (ticket.status === SUPPORT_STATUSES.CLOSED) {
      throw new ApiError(400, 'No se puede responder un ticket cerrado');
    }

    const orgId = ticket.organizationId?._id ?? ticket.organizationId;
    const message = await supportRepository.createMessage({
      ticketId: ticket._id,
      organizationId: orgId,
      authorUserId: userId,
      authorType,
      body: body.trim(),
      isInternal: Boolean(isInternal),
    });

    const patch = {
      lastMessageAt: new Date(),
      messageCount: (ticket.messageCount || 0) + 1,
    };

    const fromPlatform = authorType === SUPPORT_AUTHOR_TYPES.PLATFORM_USER;
    if (fromPlatform && !ticket.firstResponseAt) {
      patch.firstResponseAt = new Date();
    }

    if (fromPlatform && ticket.status === SUPPORT_STATUSES.OPEN) {
      patch.status = SUPPORT_STATUSES.IN_PROGRESS;
    } else if (!fromPlatform && ticket.status === SUPPORT_STATUSES.WAITING_CUSTOMER) {
      patch.status = SUPPORT_STATUSES.IN_PROGRESS;
    } else if (fromPlatform && ticket.status === SUPPORT_STATUSES.IN_PROGRESS) {
      patch.status = SUPPORT_STATUSES.WAITING_CUSTOMER;
    }

    const updated = await supportRepository.updateTicket(ticket._id, patch);

    await auditService.log({
      userId,
      organizationId: orgId,
      module: 'support',
      action: SUPPORT_AUDIT_ACTIONS.REPLIED,
      description: `Respuesta en ticket ${ticket.numberLabel}`,
      entityType: 'support_ticket',
      entityId: ticket._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { isInternal, authorType },
    });

    if (!isInternal) {
      await supportNotifications.ticketReplied({
        organizationId: orgId,
        ticket: updated,
        actorUserId: userId,
        fromPlatform,
      });
    }

    return { ticket: updated, message };
  }

  async changeStatus({
    ticketId,
    organizationId = null,
    userId,
    status,
    auditContext = {},
  }) {
    if (!Object.values(SUPPORT_STATUSES).includes(status)) {
      throw new ApiError(400, 'Estado inválido');
    }

    const ticket = organizationId
      ? await this.getForOrganization(ticketId, organizationId)
      : await this.getById(ticketId);

    const previousStatus = ticket.status;
    if (previousStatus === status) {
      return ticket;
    }

    // Org solo puede cerrar / marcar resuelto
    if (organizationId) {
      const allowed = [SUPPORT_STATUSES.RESOLVED, SUPPORT_STATUSES.CLOSED];
      if (!allowed.includes(status)) {
        throw new ApiError(403, 'Solo puede marcar como resuelto o cerrado');
      }
    }

    const orgId = ticket.organizationId?._id ?? ticket.organizationId;
    const patch = { status };

    if (status === SUPPORT_STATUSES.RESOLVED && !ticket.resolvedAt) {
      patch.resolvedAt = new Date();
    }
    if (status === SUPPORT_STATUSES.CLOSED) {
      patch.closedAt = new Date();
      patch.closedByUserId = userId;
      if (!ticket.resolvedAt) patch.resolvedAt = new Date();
    }

    const updated = await supportRepository.updateTicket(ticket._id, patch);

    await auditService.log({
      userId,
      organizationId: orgId,
      module: 'support',
      action:
        status === SUPPORT_STATUSES.CLOSED
          ? SUPPORT_AUDIT_ACTIONS.CLOSED
          : SUPPORT_AUDIT_ACTIONS.STATUS_CHANGED,
      description: `Estado ${ticket.numberLabel}: ${previousStatus} → ${status}`,
      entityType: 'support_ticket',
      entityId: ticket._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { previousStatus, status },
    });

    if (status === SUPPORT_STATUSES.CLOSED) {
      await supportNotifications.ticketClosed({
        organizationId: orgId,
        ticket: updated,
        actorUserId: userId,
      });
    } else {
      await supportNotifications.statusChanged({
        organizationId: orgId,
        ticket: updated,
        actorUserId: userId,
        previousStatus,
      });
    }

    return updated;
  }

  async assign({ ticketId, assignedToUserId, userId, auditContext = {} }) {
    const ticket = await this.getById(ticketId);
    const orgId = ticket.organizationId?._id ?? ticket.organizationId;

    const updated = await supportRepository.updateTicket(ticketId, {
      assignedToUserId: assignedToUserId || null,
      status:
        ticket.status === SUPPORT_STATUSES.OPEN
          ? SUPPORT_STATUSES.IN_PROGRESS
          : ticket.status,
    });

    await auditService.log({
      userId,
      organizationId: orgId,
      module: 'support',
      action: SUPPORT_AUDIT_ACTIONS.ASSIGNED,
      description: `Asignación en ticket ${ticket.numberLabel}`,
      entityType: 'support_ticket',
      entityId: ticketId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { assignedToUserId },
    });

    return updated;
  }

  async getMetrics() {
    return supportRepository.getMetrics();
  }
}

export const ticketService = new TicketService();
/** Alias de arquitectura */
export { TicketService as SupportTicketService, ticketService as supportTicketService };
