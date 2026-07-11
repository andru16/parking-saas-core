import Organization from '#modules/organization/organization.model.js';
import Subscription from '#modules/subscription/subscription.model.js';
import { daysUntil } from '#services/subscription-engine/constants.js';

const ALERT_FILTERS = Object.freeze({
  trials_expiring: 'trials_expiring',
  subscriptions_expired: 'subscriptions_expired',
  suspended: 'suspended',
  grace_period: 'grace_period',
  subscriptions_expiring: 'subscriptions_expiring',
});

/**
 * Listados de alertas del motor de suscripciones para Super Admin.
 */
export class SubscriptionAlertsService {
  get filters() {
    return ALERT_FILTERS;
  }

  async list({ filter, search, page = 1, limit = 20 } = {}) {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const take = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;

    let query = {};
    switch (filter) {
      case ALERT_FILTERS.trials_expiring:
        query = {
          status: 'trial',
          endDate: { $gte: now, $lte: in7Days },
        };
        break;
      case ALERT_FILTERS.subscriptions_expiring:
        query = {
          status: 'active',
          endDate: { $gte: now, $lte: in30Days },
        };
        break;
      case ALERT_FILTERS.subscriptions_expired:
        query = { status: 'expired' };
        break;
      case ALERT_FILTERS.suspended:
        query = { status: 'suspended' };
        break;
      case ALERT_FILTERS.grace_period:
        query = { status: 'grace_period' };
        break;
      default:
        query = {
          status: { $in: ['trial', 'active', 'grace_period', 'suspended', 'expired'] },
          $or: [
            { status: 'trial', endDate: { $gte: now, $lte: in7Days } },
            { status: 'active', endDate: { $gte: now, $lte: in30Days } },
            { status: { $in: ['grace_period', 'suspended', 'expired'] } },
          ],
        };
    }

    const [items, total, counts] = await Promise.all([
      Subscription.find(query)
        .populate('planId', 'name code color isTrialPlan')
        .sort({ endDate: 1 })
        .skip(skip)
        .limit(take)
        .lean(),
      Subscription.countDocuments(query),
      this.#counts(now, in7Days, in30Days),
    ]);

    const orgIds = items.map((s) => s.organizationId);
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select('name email city status')
      .lean();
    const orgMap = new Map(orgs.map((o) => [o._id.toString(), o]));

    let rows = items.map((s) => this.#toRow(s, orgMap.get(s.organizationId.toString()), now));

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.organization?.name?.toLowerCase().includes(q) ||
          r.organization?.email?.toLowerCase().includes(q) ||
          r.plan?.name?.toLowerCase().includes(q),
      );
    }

    return {
      filter: filter || 'all',
      counts,
      items: rows,
      pagination: {
        page: Math.max(1, page),
        limit: take,
        total: search?.trim() ? rows.length : total,
        totalPages: Math.ceil((search?.trim() ? rows.length : total) / take) || 1,
      },
    };
  }

  async #counts(now, in7Days, in30Days) {
    const [trialsExpiring, subscriptionsExpiring, expired, suspended, gracePeriod] =
      await Promise.all([
        Subscription.countDocuments({
          status: 'trial',
          endDate: { $gte: now, $lte: in7Days },
        }),
        Subscription.countDocuments({
          status: 'active',
          endDate: { $gte: now, $lte: in30Days },
        }),
        Subscription.countDocuments({ status: 'expired' }),
        Subscription.countDocuments({ status: 'suspended' }),
        Subscription.countDocuments({ status: 'grace_period' }),
      ]);

    return {
      trialsExpiring,
      subscriptionsExpiring,
      expired,
      suspended,
      gracePeriod,
    };
  }

  #toRow(sub, org, now) {
    return {
      id: sub._id.toString(),
      status: sub.status,
      billingCycle: sub.billingCycle,
      startDate: sub.startDate,
      endDate: sub.endDate,
      gracePeriodEndsAt: sub.gracePeriodEndsAt ?? null,
      daysRemaining: daysUntil(sub.endDate, now),
      graceDaysRemaining: sub.gracePeriodEndsAt
        ? daysUntil(sub.gracePeriodEndsAt, now)
        : null,
      plan: sub.planId
        ? {
            id: sub.planId._id.toString(),
            name: sub.planId.name,
            code: sub.planId.code,
            color: sub.planId.color,
            isTrialPlan: sub.planId.isTrialPlan,
          }
        : null,
      organization: org
        ? {
            id: org._id.toString(),
            name: org.name,
            email: org.email ?? null,
            city: org.city ?? null,
            status: org.status,
          }
        : null,
    };
  }
}

export const subscriptionAlertsService = new SubscriptionAlertsService();
