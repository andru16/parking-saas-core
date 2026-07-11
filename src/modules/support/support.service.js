import { ticketService } from './ticket.service.js';
import {
  SUPPORT_AUTHOR_TYPES,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_FEATURES,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
} from './constants.js';

/**
 * SupportService — fachada del Centro de Soporte.
 */
export class SupportService {
  getMeta() {
    return {
      categories: Object.values(SUPPORT_CATEGORIES).map((id) => ({
        id,
        label: SUPPORT_CATEGORY_LABELS[id],
      })),
      priorities: Object.values(SUPPORT_PRIORITIES).map((id) => ({
        id,
        label: SUPPORT_PRIORITY_LABELS[id],
      })),
      statuses: Object.values(SUPPORT_STATUSES).map((id) => ({
        id,
        label: SUPPORT_STATUS_LABELS[id],
      })),
      features: SUPPORT_FEATURES,
    };
  }

  // ─── Organización ───────────────────────────────────────────

  createTicket(payload) {
    return ticketService.create(payload);
  }

  listOrgTickets(organizationId, filters) {
    return ticketService.listForOrganization(organizationId, filters);
  }

  async getOrgTicketDetail(organizationId, ticketId) {
    const ticket = await ticketService.getForOrganization(ticketId, organizationId);
    const messages = await ticketService.getConversation(ticketId, {
      includeInternal: false,
    });
    return { ticket, messages };
  }

  replyAsOrg(payload) {
    return ticketService.reply({
      ...payload,
      authorType: SUPPORT_AUTHOR_TYPES.ORGANIZATION_USER,
      isInternal: false,
    });
  }

  closeAsOrg(payload) {
    return ticketService.changeStatus({
      ...payload,
      status: payload.status || 'closed',
    });
  }

  // ─── Plataforma ─────────────────────────────────────────────

  listAllTickets(filters) {
    return ticketService.listAll(filters);
  }

  async getPlatformTicketDetail(ticketId) {
    const ticket = await ticketService.getById(ticketId);
    const messages = await ticketService.getConversation(ticketId, {
      includeInternal: true,
    });
    return { ticket, messages };
  }

  replyAsPlatform(payload) {
    return ticketService.reply({
      ...payload,
      authorType: SUPPORT_AUTHOR_TYPES.PLATFORM_USER,
    });
  }

  changeStatusAsPlatform(payload) {
    return ticketService.changeStatus(payload);
  }

  assignTicket(payload) {
    return ticketService.assign(payload);
  }

  getMetrics() {
    return ticketService.getMetrics();
  }
}

export const supportService = new SupportService();
