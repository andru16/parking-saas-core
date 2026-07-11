import Subscription from '#modules/subscription/subscription.model.js';
import {
  daysUntil,
  matchingReminderThreshold,
  reminderKey,
  SUBSCRIPTION_REMINDER_DAYS,
  TRIAL_REMINDER_DAYS,
  LIFECYCLE_SOURCES,
} from './constants.js';
import { subscriptionLifecycle } from './subscriptionLifecycle.service.js';
import { subscriptionNotifier } from './subscriptionNotifier.service.js';

/**
 * Evalúa el estado de las suscripciones y decide acciones (avisos / transiciones).
 * No ejecuta cron; solo valida y delega a Lifecycle / Notifier.
 */
export class SubscriptionValidator {
  /**
   * Recorre suscripciones relevantes y aplica reglas del día.
   */
  async validateAll({ now = new Date(), source = LIFECYCLE_SOURCES.SCHEDULER } = {}) {
    const summary = {
      scanned: 0,
      reminders: 0,
      graceStarted: 0,
      suspended: 0,
      errors: [],
    };

    const candidates = await Subscription.find({
      status: { $in: ['trial', 'active', 'grace_period'] },
    })
      .select(
        '_id organizationId planId status billingCycle startDate endDate gracePeriodEndsAt remindersSent',
      )
      .lean(false);

    summary.scanned = candidates.length;

    for (const subscription of candidates) {
      try {
        const result = await this.validateOne(subscription, { now, source });
        if (result.reminderSent) summary.reminders += 1;
        if (result.graceStarted) summary.graceStarted += 1;
        if (result.suspended) summary.suspended += 1;
      } catch (error) {
        summary.errors.push({
          subscriptionId: subscription._id?.toString(),
          organizationId: subscription.organizationId?.toString(),
          message: error.message,
        });
      }
    }

    return summary;
  }

  async validateOne(subscription, { now = new Date(), source = LIFECYCLE_SOURCES.SCHEDULER } = {}) {
    const result = {
      reminderSent: false,
      graceStarted: false,
      suspended: false,
    };

    if (subscription.status === 'grace_period') {
      const graceEnd = subscription.gracePeriodEndsAt
        ? new Date(subscription.gracePeriodEndsAt)
        : null;
      if (graceEnd && graceEnd <= now) {
        await subscriptionLifecycle.endGracePeriod(subscription, { source });
        result.suspended = true;
      }
      return result;
    }

    if (subscription.status === 'trial' || subscription.status === 'active') {
      const end = new Date(subscription.endDate);
      if (end <= now) {
        await subscriptionLifecycle.enterGraceOrSuspend(subscription, { source });
        result.graceStarted = true;
        return result;
      }

      const remaining = daysUntil(end, now);
      if (subscription.status === 'trial') {
        result.reminderSent = await this.#maybeRemindTrial(subscription, remaining);
      } else {
        result.reminderSent = await this.#maybeRemindActive(subscription, remaining);
      }
    }

    return result;
  }

  async #maybeRemindTrial(subscription, daysRemaining) {
    const threshold = matchingReminderThreshold(daysRemaining, TRIAL_REMINDER_DAYS);
    if (threshold == null) return false;

    const key = reminderKey('trial', threshold);
    if (subscriptionLifecycle.hasReminder(subscription, key)) return false;

    await subscriptionNotifier.notifyTrialExpiring(subscription, { daysRemaining: threshold });
    await subscriptionLifecycle.markReminderSent(subscription, key);
    return true;
  }

  async #maybeRemindActive(subscription, daysRemaining) {
    const threshold = matchingReminderThreshold(daysRemaining, SUBSCRIPTION_REMINDER_DAYS);
    if (threshold == null) return false;

    const key = reminderKey('active', threshold);
    if (subscriptionLifecycle.hasReminder(subscription, key)) return false;

    await subscriptionNotifier.notifySubscriptionExpiring(subscription, {
      daysRemaining: threshold,
    });
    await subscriptionLifecycle.markReminderSent(subscription, key);
    return true;
  }
}

export const subscriptionValidator = new SubscriptionValidator();
