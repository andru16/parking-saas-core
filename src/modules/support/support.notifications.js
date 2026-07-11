import { notificationService } from '#services/notifications/notification.service.js';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENTS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
} from '#services/notifications/notification.events.js';
import { SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS } from './constants.js';

/**
 * SupportNotifications — notificaciones in-app del help desk.
 */
export class SupportNotifications {
  async ticketCreated({ organizationId, ticket, actorUserId }) {
    await this.#emit({
      organizationId,
      actorUserId,
      event: NOTIFICATION_EVENTS.SUPPORT_TICKET_CREATED,
      type: NOTIFICATION_TYPES.INFO,
      title: 'Ticket de soporte creado',
      message: `${ticket.numberLabel}: ${ticket.subject}`,
      priority: this.#priorityFromTicket(ticket.priority),
      actionUrl: `/support/${ticket._id}`,
      metadata: { ticketId: String(ticket._id), numberLabel: ticket.numberLabel },
      alsoNotifyPlatform: true,
    });
  }

  async ticketReplied({ organizationId, ticket, actorUserId, fromPlatform }) {
    await this.#emit({
      organizationId,
      actorUserId,
      event: NOTIFICATION_EVENTS.SUPPORT_TICKET_REPLIED,
      type: NOTIFICATION_TYPES.INFO,
      title: fromPlatform ? 'Nueva respuesta de soporte' : 'Nueva respuesta en ticket',
      message: `${ticket.numberLabel}: hay un nuevo mensaje`,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      actionUrl: fromPlatform ? `/support/${ticket._id}` : `/admin/support/${ticket._id}`,
      metadata: { ticketId: String(ticket._id) },
      alsoNotifyPlatform: !fromPlatform,
      platformOnly: false,
    });
  }

  async statusChanged({ organizationId, ticket, actorUserId, previousStatus }) {
    await this.#emit({
      organizationId,
      actorUserId,
      event: NOTIFICATION_EVENTS.SUPPORT_TICKET_STATUS_CHANGED,
      type: NOTIFICATION_TYPES.WARNING,
      title: 'Estado del ticket actualizado',
      message: `${ticket.numberLabel}: ${SUPPORT_STATUS_LABELS[previousStatus] ?? previousStatus} → ${SUPPORT_STATUS_LABELS[ticket.status] ?? ticket.status}`,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      actionUrl: `/support/${ticket._id}`,
      metadata: { ticketId: String(ticket._id), status: ticket.status },
    });
  }

  async ticketClosed({ organizationId, ticket, actorUserId }) {
    await this.#emit({
      organizationId,
      actorUserId,
      event: NOTIFICATION_EVENTS.SUPPORT_TICKET_CLOSED,
      type: NOTIFICATION_TYPES.SUCCESS,
      title: 'Ticket de soporte cerrado',
      message: `${ticket.numberLabel} fue cerrado`,
      priority: NOTIFICATION_PRIORITIES.LOW,
      actionUrl: `/support/${ticket._id}`,
      metadata: { ticketId: String(ticket._id) },
      alsoNotifyPlatform: true,
    });
  }

  #priorityFromTicket(priority) {
    if (priority === 'critical') return NOTIFICATION_PRIORITIES.CRITICAL;
    if (priority === 'high') return NOTIFICATION_PRIORITIES.HIGH;
    if (priority === 'low') return NOTIFICATION_PRIORITIES.LOW;
    return NOTIFICATION_PRIORITIES.MEDIUM;
  }

  async #emit({
    organizationId,
    actorUserId,
    event,
    type,
    title,
    message,
    priority,
    actionUrl,
    metadata,
    alsoNotifyPlatform = false,
  }) {
    try {
      await notificationService.emit(
        {
          organizationId,
          userId: null,
          category: NOTIFICATION_CATEGORIES.SUPPORT,
          type,
          event,
          title,
          message,
          priority,
          actionUrl,
          metadata,
        },
        { channels: ['in_app'], actorUserId },
      );

      if (alsoNotifyPlatform) {
        await notificationService.emit(
          {
            organizationId: null,
            userId: null,
            category: NOTIFICATION_CATEGORIES.SUPPORT,
            type,
            event,
            title: `[Soporte] ${title}`,
            message: `${message}${SUPPORT_PRIORITY_LABELS[metadata?.priority] ? '' : ''}`,
            priority,
            actionUrl: `/admin/support/${metadata?.ticketId ?? ''}`,
            metadata,
          },
          { channels: ['in_app'], actorUserId },
        );
      }
    } catch (error) {
      console.error('[SupportNotifications]', error.message);
    }
  }
}

export const supportNotifications = new SupportNotifications();
