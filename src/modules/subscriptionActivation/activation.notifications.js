import { notificationService } from '#services/notifications/notification.service.js';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENTS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
} from '#services/notifications/notification.events.js';

/**
 * Avisos in-app de activación → Centro de Notificaciones (plataforma).
 * La gestión (aprobar/rechazar) se abre desde el enlace de la notificación.
 */
export class ActivationNotifications {
  async requestCreated({ organizationId, organizationName, request, planName, actorUserId }) {
    const requestId = String(request.id || request._id);
    try {
      await notificationService.emit(
        {
          organizationId: null,
          userId: null,
          category: NOTIFICATION_CATEGORIES.SUPER_ADMIN,
          type: NOTIFICATION_TYPES.WARNING,
          event: NOTIFICATION_EVENTS.ACTIVATION_REQUEST_CREATED,
          title: 'Nueva solicitud de activación',
          message: `${organizationName} pidió activar el plan ${planName}. Empresa: ${request.company}. Contacto: ${request.contactName} (${request.email}).`,
          priority: NOTIFICATION_PRIORITIES.HIGH,
          actionUrl: `/admin/activations/${requestId}`,
          metadata: {
            requestId,
            organizationId: String(organizationId),
            planName,
            company: request.company,
            contactName: request.contactName,
            email: request.email,
            phone: request.phone,
          },
        },
        { channels: ['in_app'], actorUserId },
      );
    } catch (error) {
      console.error('[ActivationNotifications] requestCreated:', error.message);
    }
  }

  async requestApproved({ organizationId, planName, actorUserId }) {
    try {
      await notificationService.emit(
        {
          organizationId,
          userId: null,
          category: NOTIFICATION_CATEGORIES.SUBSCRIPTIONS,
          type: NOTIFICATION_TYPES.SUCCESS,
          event: NOTIFICATION_EVENTS.ACTIVATION_REQUEST_APPROVED,
          title: 'Suscripción activada',
          message: `Tu plan ${planName} ya está activo. Ya puedes usar Parking SaaS sin restricciones.`,
          priority: NOTIFICATION_PRIORITIES.HIGH,
          actionUrl: '/dashboard',
          metadata: { planName },
        },
        { channels: ['in_app'], actorUserId },
      );
    } catch (error) {
      console.error('[ActivationNotifications] requestApproved:', error.message);
    }
  }

  async requestRejected({ organizationId, planName, actorUserId, reason }) {
    try {
      await notificationService.emit(
        {
          organizationId,
          userId: null,
          category: NOTIFICATION_CATEGORIES.SUBSCRIPTIONS,
          type: NOTIFICATION_TYPES.ERROR,
          event: NOTIFICATION_EVENTS.ACTIVATION_REQUEST_REJECTED,
          title: 'Solicitud de activación rechazada',
          message: reason
            ? `Tu solicitud del plan ${planName} no fue aprobada. ${reason}`
            : `Tu solicitud del plan ${planName} no fue aprobada. Contacta a soporte si necesitas ayuda.`,
          priority: NOTIFICATION_PRIORITIES.HIGH,
          actionUrl: '/activar-suscripcion',
          metadata: { planName },
        },
        { channels: ['in_app'], actorUserId },
      );
    } catch (error) {
      console.error('[ActivationNotifications] requestRejected:', error.message);
    }
  }
}

export const activationNotifications = new ActivationNotifications();
