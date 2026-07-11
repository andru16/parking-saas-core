import Organization from '#modules/organization/organization.model.js';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENTS,
  NOTIFICATION_TYPES,
  priorityForDaysRemaining,
} from '#services/notifications/notification.events.js';
import { notificationService } from '#services/notifications/notification.service.js';

/**
 * Notificaciones del ciclo de suscripciones → Centro in-app.
 */
export class SubscriptionNotifier {
  async notifyTrialExpiring(subscription, { daysRemaining }) {
    const org = await this.#orgName(subscription.organizationId);
    const priority = priorityForDaysRemaining(daysRemaining);
    const title =
      daysRemaining <= 1
        ? 'Tu trial vence mañana'
        : `Tu trial vence en ${daysRemaining} días`;

    return notificationService.emit({
      organizationId: subscription.organizationId,
      userId: null,
      category: NOTIFICATION_CATEGORIES.SUBSCRIPTIONS,
      type: daysRemaining <= 1 ? NOTIFICATION_TYPES.ERROR : NOTIFICATION_TYPES.WARNING,
      event: NOTIFICATION_EVENTS.TRIAL_EXPIRING,
      title,
      message: `${org}: el período de prueba finaliza el ${this.#fmt(subscription.endDate)}. Renueva para no interrumpir el servicio.`,
      priority,
      actionUrl: '/dashboard',
      metadata: {
        subscriptionId: subscription._id,
        daysRemaining,
        endDate: subscription.endDate,
        status: subscription.status,
      },
    });
  }

  async notifySubscriptionExpiring(subscription, { daysRemaining }) {
    const org = await this.#orgName(subscription.organizationId);
    const priority = priorityForDaysRemaining(daysRemaining);
    const title =
      daysRemaining <= 1
        ? 'Tu suscripción vence mañana'
        : `Tu suscripción vence en ${daysRemaining} días`;

    return notificationService.emit({
      organizationId: subscription.organizationId,
      userId: null,
      category: NOTIFICATION_CATEGORIES.SUBSCRIPTIONS,
      type: daysRemaining <= 1 ? NOTIFICATION_TYPES.ERROR : NOTIFICATION_TYPES.WARNING,
      event: NOTIFICATION_EVENTS.SUBSCRIPTION_EXPIRING,
      title,
      message: `${org}: la suscripción finaliza el ${this.#fmt(subscription.endDate)}. Renueva a tiempo para evitar la suspensión.`,
      priority,
      actionUrl: '/dashboard',
      metadata: {
        subscriptionId: subscription._id,
        daysRemaining,
        endDate: subscription.endDate,
        status: subscription.status,
      },
    });
  }

  async notifyGraceStarted(subscription, { wasTrial, graceDays }) {
    const org = await this.#orgName(subscription.organizationId);
    return notificationService.emit({
      organizationId: subscription.organizationId,
      userId: null,
      category: NOTIFICATION_CATEGORIES.SUBSCRIPTIONS,
      type: NOTIFICATION_TYPES.WARNING,
      event: wasTrial
        ? NOTIFICATION_EVENTS.TRIAL_ENDED
        : NOTIFICATION_EVENTS.GRACE_PERIOD_STARTED,
      title: wasTrial ? 'Trial finalizado — período de gracia' : 'Suscripción en período de gracia',
      message: `${org}: tienes ${graceDays} día(s) de gracia hasta el ${this.#fmt(subscription.gracePeriodEndsAt)}. Renueva para mantener el acceso completo.`,
      priority: 'high',
      actionUrl: '/dashboard',
      metadata: {
        subscriptionId: subscription._id,
        wasTrial,
        graceDays,
        gracePeriodEndsAt: subscription.gracePeriodEndsAt,
      },
    });
  }

  async notifySuspended(subscription, { reason }) {
    const org = await this.#orgName(subscription.organizationId);
    return notificationService.emit({
      organizationId: subscription.organizationId,
      userId: null,
      category: NOTIFICATION_CATEGORIES.ORGANIZATIONS,
      type: NOTIFICATION_TYPES.ERROR,
      event: NOTIFICATION_EVENTS.ORGANIZATION_SUSPENDED,
      title: 'Organización suspendida',
      message: `${org}: el acceso operativo está restringido. Puedes consultar datos, exportar y renovar la suscripción.`,
      priority: 'critical',
      actionUrl: '/dashboard',
      metadata: { subscriptionId: subscription._id, reason },
    });
  }

  async notifyReactivated(subscription) {
    const org = await this.#orgName(subscription.organizationId);
    return notificationService.emit({
      organizationId: subscription.organizationId,
      userId: null,
      category: NOTIFICATION_CATEGORIES.SUBSCRIPTIONS,
      type: NOTIFICATION_TYPES.SUCCESS,
      event: NOTIFICATION_EVENTS.ORGANIZATION_REACTIVATED,
      title: 'Acceso restaurado',
      message: `${org}: tu suscripción fue reactivada. Vigente hasta el ${this.#fmt(subscription.endDate)}.`,
      priority: 'medium',
      actionUrl: '/dashboard',
      metadata: {
        subscriptionId: subscription._id,
        endDate: subscription.endDate,
      },
    });
  }

  async #orgName(organizationId) {
    const org = await Organization.findById(organizationId).select('name').lean();
    return org?.name ?? 'Tu organización';
  }

  #fmt(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}

export const subscriptionNotifier = new SubscriptionNotifier();
