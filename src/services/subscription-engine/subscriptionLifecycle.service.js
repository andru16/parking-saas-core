import Organization from '#modules/organization/organization.model.js';
import Subscription, {
  OPERATIONAL_SUBSCRIPTION_STATUSES,
} from '#modules/subscription/subscription.model.js';
import SubscriptionHistory from '#modules/subscription/subscriptionHistory.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import env from '#config/env.js';
import { SUPER_ADMIN_AUDIT_MODULE } from '#modules/superAdmin/permissions.catalog.js';
import {
  getGracePeriodDays,
  LIFECYCLE_SOURCES,
  SUBSCRIPTION_ENGINE_AUDIT,
} from './constants.js';
import { subscriptionNotifier } from './subscriptionNotifier.service.js';

/**
 * Transiciones de estado de suscripción + sincronización con Organization.
 * Única fuente de verdad para cambios de ciclo de vida.
 */
export class SubscriptionLifecycle {
  /**
   * Trial o Active vencidos → Grace Period (si graceDays > 0) o Suspended.
   */
  async enterGraceOrSuspend(subscription, { source = LIFECYCLE_SOURCES.SCHEDULER, actorUserId = null } = {}) {
    const graceDays = await getGracePeriodDays();
    const wasTrial = subscription.status === 'trial';
    const now = new Date();

    if (graceDays > 0) {
      return this.#enterGracePeriod(subscription, {
        graceDays,
        wasTrial,
        now,
        source,
        actorUserId,
      });
    }

    return this.suspend(subscription.organizationId, {
      source,
      actorUserId,
      reason: wasTrial ? 'trial_ended_no_grace' : 'subscription_ended_no_grace',
      subscription,
      markExpiredFirst: true,
    });
  }

  async #enterGracePeriod(subscription, { graceDays, wasTrial, now, source, actorUserId }) {
    const previous = subscription.status;
    const gracePeriodEndsAt = new Date(now);
    gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + graceDays);

    subscription.status = 'grace_period';
    subscription.gracePeriodEndsAt = gracePeriodEndsAt;
    await subscription.save();

    // La org sigue operativa durante el grace period.
    const org = await Organization.findById(subscription.organizationId);
    if (org && org.status === 'suspended') {
      org.status = wasTrial || previous === 'trial' ? 'trial' : 'active';
      await org.save();
    }

    await this.#history({
      organizationId: subscription.organizationId,
      subscriptionId: subscription._id,
      fromPlanId: subscription.planId,
      toPlanId: subscription.planId,
      action: 'grace_started',
      actorUserId,
      notes: `Período de gracia ${graceDays} días`,
      metadata: { previous, gracePeriodEndsAt, source, wasTrial },
    });

    if (wasTrial || previous === 'trial') {
      await this.#history({
        organizationId: subscription.organizationId,
        subscriptionId: subscription._id,
        fromPlanId: subscription.planId,
        toPlanId: subscription.planId,
        action: 'trial_ended',
        actorUserId,
        notes: 'Trial finalizado — ingreso a período de gracia',
        metadata: { source },
      });
    } else {
      await this.#history({
        organizationId: subscription.organizationId,
        subscriptionId: subscription._id,
        fromPlanId: subscription.planId,
        toPlanId: subscription.planId,
        action: 'expired',
        actorUserId,
        notes: 'Suscripción vencida — ingreso a período de gracia',
        metadata: { source },
      });
    }

    await auditService.log({
      userId: actorUserId,
      organizationId: subscription.organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: wasTrial ? SUBSCRIPTION_ENGINE_AUDIT.TRIAL_ENDED : SUBSCRIPTION_ENGINE_AUDIT.EXPIRED,
      description: wasTrial
        ? 'Trial finalizado; organización en período de gracia'
        : 'Suscripción vencida; organización en período de gracia',
      resourceId: subscription.organizationId,
      metadata: {
        subscriptionId: subscription._id,
        previous,
        next: 'grace_period',
        gracePeriodEndsAt,
        source,
      },
    });

    await auditService.log({
      userId: actorUserId,
      organizationId: subscription.organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUBSCRIPTION_ENGINE_AUDIT.GRACE_STARTED,
      description: `Ingreso a período de gracia (${graceDays} días)`,
      resourceId: subscription.organizationId,
      metadata: { subscriptionId: subscription._id, gracePeriodEndsAt, source },
    });

    await subscriptionNotifier.notifyGraceStarted(subscription, { wasTrial, graceDays });

    return { subscription, transition: 'grace_period' };
  }

  /**
   * Finaliza grace → Suspended.
   */
  async endGracePeriod(subscription, { source = LIFECYCLE_SOURCES.SCHEDULER, actorUserId = null } = {}) {
    await auditService.log({
      userId: actorUserId,
      organizationId: subscription.organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUBSCRIPTION_ENGINE_AUDIT.GRACE_ENDED,
      description: 'Período de gracia finalizado',
      resourceId: subscription.organizationId,
      metadata: { subscriptionId: subscription._id, source },
    });

    return this.suspend(subscription.organizationId, {
      source,
      actorUserId,
      reason: 'grace_period_ended',
      subscription,
    });
  }

  async suspend(
    organizationId,
    {
      source = LIFECYCLE_SOURCES.SUPER_ADMIN,
      actorUserId = null,
      reason = 'manual',
      notes = '',
      auditContext = {},
      subscription = null,
      markExpiredFirst = false,
    } = {},
  ) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    let sub =
      subscription ||
      (await Subscription.findOne({
        organizationId,
        status: { $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES, 'grace_period'] },
      }).sort({ endDate: -1 }));

    if (!sub) {
      sub = await Subscription.findOne({ organizationId }).sort({ updatedAt: -1 });
    }

    if (sub && markExpiredFirst && sub.status !== 'expired' && sub.status !== 'suspended') {
      const prev = sub.status;
      sub.status = 'expired';
      await sub.save();
      await this.#history({
        organizationId,
        subscriptionId: sub._id,
        fromPlanId: sub.planId,
        toPlanId: sub.planId,
        action: 'expired',
        actorUserId,
        notes: 'Marcado expired antes de suspensión',
        metadata: { previous: prev, source },
      });
    }

    if (sub && sub.status !== 'suspended') {
      const previous = sub.status;
      sub.status = 'suspended';
      sub.gracePeriodEndsAt = null;
      await sub.save();

      await this.#history({
        organizationId,
        subscriptionId: sub._id,
        fromPlanId: sub.planId,
        toPlanId: sub.planId,
        action: 'suspended',
        actorUserId,
        notes: notes || reason,
        metadata: { previous, source, reason },
      });
    }

    const previousOrgStatus = org.status;
    org.status = 'suspended';
    await org.save();

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUBSCRIPTION_ENGINE_AUDIT.SUSPENDED,
      description: `Organización suspendida (${reason})`,
      resourceId: organizationId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: {
        previousOrgStatus,
        source,
        reason,
        subscriptionId: sub?._id ?? null,
      },
    });

    if (sub) {
      await subscriptionNotifier.notifySuspended(sub, { reason });
    }

    return { organization: org, subscription: sub, transition: 'suspended' };
  }

  /**
   * Reactiva acceso: org active + suscripción active (extiende endDate si ya venció).
   */
  async reactivate(
    organizationId,
    {
      source = LIFECYCLE_SOURCES.SUPER_ADMIN,
      actorUserId = null,
      notes = '',
      auditContext = {},
      extendDays = null,
    } = {},
  ) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    let sub = await Subscription.findOne({
      organizationId,
      status: { $in: ['suspended', 'expired', 'grace_period', 'cancelled'] },
    }).sort({ updatedAt: -1 });

    if (!sub) {
      sub = await Subscription.findOne({ organizationId }).sort({ endDate: -1 });
    }

    if (!sub) {
      throw new ApiError(404, 'No hay suscripción para reactivar');
    }

    const previous = sub.status;
    const now = new Date();
    const days =
      extendDays ??
      Math.max(1, env.subscription.reactivationDefaultDays || 30);

    if (!sub.endDate || sub.endDate <= now) {
      const end = new Date(now);
      end.setDate(end.getDate() + days);
      sub.endDate = end;
    }

    sub.status = 'active';
    sub.billingCycle = sub.billingCycle === 'trial' ? 'monthly' : sub.billingCycle;
    sub.gracePeriodEndsAt = null;
    sub.remindersSent = [];
    await sub.save();

    const previousOrgStatus = org.status;
    org.status = 'active';
    await org.save();

    await this.#history({
      organizationId,
      subscriptionId: sub._id,
      fromPlanId: sub.planId,
      toPlanId: sub.planId,
      action: 'reactivated',
      actorUserId,
      notes: notes || 'Reactivación',
      metadata: { previous, source, endDate: sub.endDate },
    });

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUBSCRIPTION_ENGINE_AUDIT.REACTIVATED,
      description: `Suscripción reactivada: ${org.name}`,
      resourceId: organizationId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: {
        previous,
        previousOrgStatus,
        next: 'active',
        source,
        endDate: sub.endDate,
      },
    });

    await subscriptionNotifier.notifyReactivated(sub);

    return { organization: org, subscription: sub, transition: 'active' };
  }

  async activate(
    organizationId,
    { source = LIFECYCLE_SOURCES.SUPER_ADMIN, actorUserId = null, auditContext = {} } = {},
  ) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    if (org.status === 'suspended') {
      return this.reactivate(organizationId, { source, actorUserId, auditContext });
    }

    org.status = 'active';
    await org.save();

    const sub = await Subscription.findOne({
      organizationId,
      status: { $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES] },
    }).sort({ endDate: -1 });

    if (sub && sub.status === 'trial') {
      // Solo cambia org; trial sigue hasta su endDate.
    }

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUBSCRIPTION_ENGINE_AUDIT.STATUS_CHANGED,
      description: `Organización activada: ${org.name}`,
      resourceId: organizationId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { source, status: 'active' },
    });

    return { organization: org, subscription: sub, transition: 'active' };
  }

  async markReminderSent(subscription, key) {
    const entry = { key, sentAt: new Date() };
    const existing = Array.isArray(subscription.remindersSent) ? subscription.remindersSent : [];
    if (existing.some((r) => r.key === key)) return subscription;
    subscription.remindersSent = [...existing, entry];
    await subscription.save();
    return subscription;
  }

  hasReminder(subscription, key) {
    return (subscription.remindersSent || []).some((r) => r.key === key);
  }

  async #history(payload) {
    await SubscriptionHistory.create({
      organizationId: payload.organizationId,
      subscriptionId: payload.subscriptionId ?? null,
      fromPlanId: payload.fromPlanId ?? null,
      toPlanId: payload.toPlanId ?? null,
      action: payload.action,
      changeMode: 'immediate',
      billingCycle: payload.billingCycle ?? null,
      actorUserId: payload.actorUserId ?? null,
      notes: payload.notes ?? '',
      metadata: payload.metadata ?? {},
    });
  }
}

export const subscriptionLifecycle = new SubscriptionLifecycle();
