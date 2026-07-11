import Organization from '#modules/organization/organization.model.js';
import Subscription from '#modules/subscription/subscription.model.js';
import User from '#modules/user/user.model.js';
import Ticket from '#modules/ticket/ticket.model.js';

/**
 * Métricas globales de la plataforma (no scoped a tenant).
 */
export class SuperAdminDashboardService {
  async getMetrics() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      orgsActive,
      orgsTrial,
      orgsSuspended,
      orgsPending,
      trialsActive,
      trialsExpiringSoon,
      subscriptionsActivePaid,
      subscriptionsGrace,
      subscriptionsSuspended,
      subscriptionsExpired,
      subscriptionsExpiring,
      newOrgsThisMonth,
      totalUsers,
      totalTickets,
      activeSubsWithPlan,
    ] = await Promise.all([
      Organization.countDocuments({ status: 'active' }),
      Organization.countDocuments({ status: 'trial' }),
      Organization.countDocuments({ status: 'suspended' }),
      Organization.countDocuments({ status: 'pending_verification' }),
      Subscription.countDocuments({
        status: 'trial',
        endDate: { $gte: now },
      }),
      Subscription.countDocuments({
        status: 'trial',
        endDate: { $gte: now, $lte: in7Days },
      }),
      Subscription.countDocuments({
        status: 'active',
        endDate: { $gte: now },
      }),
      Subscription.countDocuments({ status: 'grace_period' }),
      Subscription.countDocuments({ status: 'suspended' }),
      Subscription.countDocuments({ status: 'expired' }),
      Subscription.countDocuments({
        status: { $in: ['active', 'trial'] },
        endDate: { $gte: now, $lte: in30Days },
      }),
      Organization.countDocuments({ createdAt: { $gte: monthStart } }),
      User.countDocuments({ organizationId: { $ne: null } }),
      Ticket.countDocuments({}),
      Subscription.find({
        status: { $in: ['active', 'grace_period'] },
      })
        .populate('planId', 'price code name durationDays pricing isTrialPlan')
        .lean(),
    ]);

    const estimatedMrr = this.#estimateMrr(activeSubsWithPlan);

    return {
      organizations: {
        active: orgsActive,
        trial: orgsTrial,
        suspended: orgsSuspended,
        pendingVerification: orgsPending,
        total: orgsActive + orgsTrial + orgsSuspended + orgsPending,
      },
      subscriptions: {
        active: subscriptionsActivePaid,
        trialsActive,
        trialsExpiringSoon,
        gracePeriod: subscriptionsGrace,
        suspended: subscriptionsSuspended,
        expired: subscriptionsExpired,
        expiringSoon: subscriptionsExpiring,
      },
      newRegistrationsThisMonth: newOrgsThisMonth,
      estimatedMrr,
      totalUsers,
      totalTicketsProcessed: totalTickets,
      generatedAt: now.toISOString(),
      currency: 'COP',
      region: 'LATAM',
    };
  }

  #estimateMrr(subscriptions) {
    let mrr = 0;
    for (const sub of subscriptions) {
      const plan = sub.planId;
      if (!plan || plan.isTrialPlan || plan.code === 'trial') continue;
      if (sub.status === 'grace_period') continue;
      const monthly = Number(plan.pricing?.monthly ?? plan.price ?? 0);
      mrr += monthly;
    }
    return Math.round(mrr * 100) / 100;
  }

  async listPlans() {
    const { planService } = await import('#services/saas-billing/plan.service.js');
    return planService.list({ includeInactive: false, commercialOnly: true });
  }
}

export const superAdminDashboardService = new SuperAdminDashboardService();
