import Organization from '#modules/organization/organization.model.js';
import Subscription, {
  OPERATIONAL_SUBSCRIPTION_STATUSES,
} from '#modules/subscription/subscription.model.js';
import SubscriptionHistory from '#modules/subscription/subscriptionHistory.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import env from '#config/env.js';
import {
  SUPER_ADMIN_AUDIT_ACTIONS,
  SUPER_ADMIN_AUDIT_MODULE,
} from '#modules/superAdmin/permissions.catalog.js';
import { planService } from './plan.service.js';
import { priceForCycle, resolveCycleDays } from './billingCycles.js';
import { settingsService } from '#modules/systemSettings/settings.service.js';

export const SUBSCRIPTION_AUDIT = Object.freeze({
  CREATED: 'sa_subscription_created',
  CHANGED: SUPER_ADMIN_AUDIT_ACTIONS.ORG_PLAN_CHANGED,
  RENEWED: 'sa_subscription_renewed',
  CANCELLED: 'sa_subscription_cancelled',
  SUSPENDED: 'sa_subscription_suspended',
  TRIAL_EXTENDED: SUPER_ADMIN_AUDIT_ACTIONS.ORG_TRIAL_EXTENDED,
});

/**
 * Gestión de suscripciones SaaS (una vigente por Organization).
 */
export class SubscriptionService {
  async getActiveForOrganization(organizationId) {
    return Subscription.findOne({
      organizationId,
      status: { $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES] },
    })
      .populate('planId')
      .sort({ endDate: -1 });
  }

  async getSummaryForOrganization(organizationId) {
    let sub = await this.getActiveForOrganization(organizationId);

    if (!sub) {
      sub = await Subscription.findOne({
        organizationId,
        status: {
          $in: ['awaiting_activation', 'suspended', 'expired', 'cancelled'],
        },
      })
        .populate('planId')
        .sort({ updatedAt: -1 });
    }

    if (!sub) {
      return {
        hasSubscription: false,
        plan: null,
        status: null,
        billingCycle: null,
        startDate: null,
        endDate: null,
        daysRemaining: 0,
        nextRenewalAt: null,
        autoRenewal: false,
        gracePeriodEndsAt: null,
        accessMode: 'none',
        isTrialPremium: false,
        isAwaitingActivation: false,
        isBlocked: false,
      };
    }

    const plan = sub.planId;
    const now = Date.now();
    const end = new Date(sub.endDate).getTime();
    const daysRemaining = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
    const isOperational = OPERATIONAL_SUBSCRIPTION_STATUSES.includes(sub.status);
    const isAwaitingActivation = sub.status === 'awaiting_activation';
    const isTrialPremium = sub.status === 'trial_premium';
    /** Bloqueo total tras fin de trial premium (sin gracia). */
    const isBlocked = sub.status === 'expired';

    let accessMode = 'read_only';
    if (isOperational) accessMode = 'full';
    else if (isAwaitingActivation) accessMode = 'activation_pending';
    else if (isBlocked) accessMode = 'blocked';

    return {
      hasSubscription: true,
      plan: plan
        ? {
            id: plan._id.toString(),
            name: plan.name,
            code: plan.code,
            color: plan.color,
            isTrialPlan: plan.isTrialPlan,
            priceMonthly: plan.pricing?.monthly ?? plan.price ?? null,
            features:
              plan.features instanceof Map
                ? Object.fromEntries(plan.features)
                : { ...(plan.features || {}) },
            limits: plan.limits ?? {},
          }
        : null,
      status: sub.status,
      billingCycle: sub.billingCycle,
      billingCycleLabel:
        {
          trial: 'Trial',
          monthly: 'Mensual',
          quarterly: 'Trimestral',
          semiannual: 'Semestral',
          annual: 'Anual',
        }[sub.billingCycle] ?? sub.billingCycle,
      startDate: sub.startDate,
      endDate: sub.endDate,
      daysRemaining: isOperational || isAwaitingActivation ? daysRemaining : 0,
      nextRenewalAt: sub.endDate,
      autoRenewal: sub.autoRenewal,
      gracePeriodEndsAt: sub.gracePeriodEndsAt ?? null,
      accessMode,
      isTrialPremium,
      isAwaitingActivation,
      isBlocked,
      scheduledChange: sub.scheduledPlanId
        ? {
            planId: sub.scheduledPlanId,
            billingCycle: sub.scheduledBillingCycle,
            at: sub.scheduledAt,
            mode: sub.changeMode,
          }
        : null,
    };
  }

  async listHistory(organizationId, { limit = 50 } = {}) {
    const rows = await SubscriptionHistory.find({ organizationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('fromPlanId', 'name code')
      .populate('toPlanId', 'name code')
      .lean();

    return rows.map((r) => ({
      id: r._id.toString(),
      action: r.action,
      changeMode: r.changeMode,
      billingCycle: r.billingCycle,
      notes: r.notes,
      fromPlan: r.fromPlanId
        ? { id: r.fromPlanId._id.toString(), name: r.fromPlanId.name, code: r.fromPlanId.code }
        : null,
      toPlan: r.toPlanId
        ? { id: r.toPlanId._id.toString(), name: r.toPlanId.name, code: r.toPlanId.code }
        : null,
      createdAt: r.createdAt,
      metadata: r.metadata ?? {},
    }));
  }

  /**
   * Crea la suscripción inicial (bootstrap / signup).
   * @param {'trial'|'awaiting_activation'|'active'} [options.mode]
   */
  async createInitial(
    organizationId,
    plan,
    { session = null, actorUserId = null, mode = null } = {},
  ) {
    await this.#assertNoOperational(organizationId, session);

    const isTrialPlan = Boolean(plan.isTrialPlan || plan.code === 'trial');
    const resolvedMode =
      mode || (isTrialPlan ? 'trial' : 'awaiting_activation');

    const saas = await settingsService.getSaasDefaults();
    const startDate = new Date();
    let billingCycle = 'monthly';
    let status = 'awaiting_activation';
    let days = 1;

    if (resolvedMode === 'trial' || isTrialPlan) {
      billingCycle = 'trial';
      status = 'trial';
      days = saas.trialDays;
    } else if (resolvedMode === 'awaiting_activation') {
      billingCycle = 'monthly';
      status = 'awaiting_activation';
      days = saas.trialPremiumDays || 3;
    } else {
      billingCycle = 'monthly';
      status = 'active';
      days = resolveCycleDays(billingCycle, {
        trialDays: saas.trialDays,
        planDefaultDays: plan.defaultDurationDays || plan.durationDays,
      });
    }

    const endDate = this.#addDays(startDate, days);

    const [subscription] = await Subscription.create(
      [
        {
          organizationId,
          planId: plan._id,
          billingCycle,
          startDate,
          endDate,
          status,
          autoRenewal: false,
          paymentMethod: 'none',
          amountPaid: status === 'active' ? priceForCycle(plan, billingCycle) : 0,
          billingProvider: 'none',
        },
      ],
      { session },
    );

    await this.#history(
      {
        organizationId,
        subscriptionId: subscription._id,
        fromPlanId: null,
        toPlanId: plan._id,
        action: 'created',
        billingCycle,
        actorUserId,
        notes:
          status === 'awaiting_activation'
            ? 'Suscripción pendiente de iniciar prueba premium'
            : 'Suscripción inicial',
      },
      session,
    );

    return subscription;
  }

  /**
   * Inicia la prueba premium (3 días) del plan de pago seleccionado.
   */
  async startPremiumTrial(organizationId, actorUserId = null) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    const saas = await settingsService.getSaasDefaults();
    const premiumDays = Math.max(1, Number(saas.trialPremiumDays) || 3);

    let subscription = await Subscription.findOne({
      organizationId,
      status: { $in: ['awaiting_activation', 'trial_premium', 'expired', 'suspended'] },
    }).sort({ updatedAt: -1 });

    if (!subscription) {
      subscription = await Subscription.findOne({ organizationId }).sort({ updatedAt: -1 });
    }

    if (!subscription) {
      throw new ApiError(400, 'No hay suscripción para iniciar la prueba');
    }

    if (subscription.status === 'trial_premium' && subscription.endDate > new Date()) {
      return subscription;
    }

    if (subscription.status === 'active') {
      throw new ApiError(400, 'La suscripción ya está activa');
    }

    const planId = org.intendedPlanId || subscription.planId;
    const plan = await planService.resolveActivePlanById(planId);

    const startDate = new Date();
    const endDate = this.#addDays(startDate, premiumDays);

    subscription.planId = plan._id;
    subscription.billingCycle = 'monthly';
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.status = 'trial_premium';
    subscription.gracePeriodEndsAt = null;
    await subscription.save();

    org.status = 'trial';
    org.intendedPlanId = plan._id;
    await org.save();

    await this.#history(
      {
        organizationId,
        subscriptionId: subscription._id,
        fromPlanId: null,
        toPlanId: plan._id,
        action: 'trial_premium_started',
        billingCycle: 'monthly',
        actorUserId,
        notes: `Prueba premium ${premiumDays} días`,
      },
      null,
    );

    return subscription.populate('planId');
  }

  /**
   * Activa la suscripción de pago tras aprobación manual (pre-pasarela).
   */
  async activateFromRequest(
    organizationId,
    {
      planId,
      startDate,
      endDate,
      notes = '',
      actorUserId = null,
    } = {},
  ) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    const plan = await planService.resolveActivePlanById(planId || org.intendedPlanId);
    let subscription = await Subscription.findOne({ organizationId }).sort({ updatedAt: -1 });

    if (!subscription) {
      throw new ApiError(400, 'No hay suscripción para activar');
    }

    const fromPlanId = subscription.planId;
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate
      ? new Date(endDate)
      : this.#addDays(
          start,
          resolveCycleDays('monthly', {
            trialDays: (await settingsService.getSaasDefaults()).trialDays,
            planDefaultDays: plan.defaultDurationDays || plan.durationDays,
          }),
        );

    if (end <= start) {
      throw new ApiError(400, 'La fecha de vencimiento debe ser posterior al inicio');
    }

    subscription.planId = plan._id;
    subscription.billingCycle = 'monthly';
    subscription.startDate = start;
    subscription.endDate = end;
    subscription.status = 'active';
    subscription.gracePeriodEndsAt = null;
    subscription.amountPaid = priceForCycle(plan, 'monthly');
    subscription.billingProvider = 'manual';
    subscription.notes = notes || subscription.notes;
    await subscription.save();

    org.status = 'active';
    org.intendedPlanId = plan._id;
    await org.save();

    await this.#history(
      {
        organizationId,
        subscriptionId: subscription._id,
        fromPlanId,
        toPlanId: plan._id,
        action: 'activation_approved',
        billingCycle: 'monthly',
        actorUserId,
        notes: notes || 'Activación manual aprobada',
      },
      null,
    );

    return subscription.populate('planId');
  }

  /**
   * Finaliza la prueba premium sin gracia: bloqueo total hasta activación.
   */
  async expirePremiumTrial(subscription, { actorUserId = null, source = 'scheduler' } = {}) {
    const previous = subscription.status;
    subscription.status = 'expired';
    subscription.gracePeriodEndsAt = null;
    await subscription.save();

    const org = await Organization.findById(subscription.organizationId);
    if (org && org.status !== 'suspended') {
      // Mantiene trial para no confundir con suspendida operativa; el bloqueo viene de la sub.
      org.status = 'trial';
      await org.save();
    }

    await this.#history(
      {
        organizationId: subscription.organizationId,
        subscriptionId: subscription._id,
        fromPlanId: subscription.planId,
        toPlanId: subscription.planId,
        action: 'trial_premium_ended',
        billingCycle: subscription.billingCycle,
        actorUserId,
        notes: 'Prueba premium finalizada — acceso bloqueado',
        metadata: { previous, source },
      },
      null,
    );

    return subscription;
  }

  async changePlan(
    organizationId,
    {
      planId,
      billingCycle = 'monthly',
      changeMode = 'immediate',
      scheduledAt = null,
      notes = '',
    },
    actorUserId,
    auditContext = {},
  ) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    const newPlan = await planService.resolveActivePlanById(planId);
    const current = await Subscription.findOne({
      organizationId,
      status: { $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES] },
    }).sort({ endDate: -1 });

    if (changeMode === 'scheduled') {
      if (!current) throw new ApiError(400, 'No hay suscripción vigente para programar un cambio');
      if (!scheduledAt) throw new ApiError(400, 'scheduledAt es obligatorio para cambio programado');

      const when = new Date(scheduledAt);
      if (when <= new Date()) throw new ApiError(400, 'La fecha programada debe ser futura');

      current.scheduledPlanId = newPlan._id;
      current.scheduledBillingCycle = billingCycle;
      current.scheduledAt = when;
      current.changeMode = 'scheduled';
      if (notes) current.notes = notes;
      await current.save();

      await this.#history({
        organizationId,
        subscriptionId: current._id,
        fromPlanId: current.planId,
        toPlanId: newPlan._id,
        action: 'scheduled_change',
        changeMode: 'scheduled',
        billingCycle,
        actorUserId,
        notes,
        metadata: { scheduledAt: when },
      });

      return {
        mode: 'scheduled',
        subscription: current,
        plan: newPlan,
      };
    }

    const fromPlanId = current?.planId ?? null;
    const action = await this.#classifyChange(fromPlanId, newPlan._id);

    if (current) {
      current.status = 'cancelled';
      current.scheduledPlanId = null;
      current.scheduledAt = null;
      current.changeMode = null;
      await current.save();
    }

    const cycle = newPlan.isTrialPlan ? 'trial' : billingCycle;
    const startDate = new Date();
    const days = resolveCycleDays(cycle, {
      trialDays: (await settingsService.getSaasDefaults()).trialDays,
      planDefaultDays: newPlan.defaultDurationDays || newPlan.durationDays,
    });
    const endDate = this.#addDays(startDate, days);
    const status = newPlan.isTrialPlan ? 'trial' : 'active';

    const subscription = await Subscription.create({
      organizationId,
      planId: newPlan._id,
      billingCycle: cycle,
      startDate,
      endDate,
      status,
      autoRenewal: false,
      paymentMethod: 'none',
      amountPaid: priceForCycle(newPlan, cycle),
      paymentReference: `sa-change-${Date.now()}`,
      notes: notes || '',
      billingProvider: 'manual',
      changeMode: 'immediate',
    });

    org.status = newPlan.isTrialPlan ? 'trial' : 'active';
    await org.save();

    await this.#history({
      organizationId,
      subscriptionId: subscription._id,
      fromPlanId,
      toPlanId: newPlan._id,
      action,
      changeMode: 'immediate',
      billingCycle: cycle,
      actorUserId,
      notes,
    });

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUBSCRIPTION_AUDIT.CHANGED,
      description: `Cambio de plan (${action}): ${org.name} → ${newPlan.name}`,
      resourceId: org._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { planId: newPlan._id, billingCycle: cycle, changeMode: 'immediate' },
    });

    return { mode: 'immediate', subscription, plan: newPlan, organization: org };
  }

  async extendTrial(organizationId, { days } = {}, actorUserId, auditContext = {}) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    const extendDays = Math.min(
      90,
      Math.max(1, Number(days) || (await settingsService.getSaasDefaults()).trialDays),
    );

    let subscription = await Subscription.findOne({
      organizationId,
      status: { $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES] },
    }).sort({ endDate: -1 });

    if (!subscription) {
      const trialPlan = await planService.resolveTrialPlan();
      subscription = await this.createInitial(organizationId, trialPlan, { actorUserId });
    } else {
      const base =
        subscription.endDate && subscription.endDate > new Date()
          ? subscription.endDate
          : new Date();
      subscription.endDate = this.#addDays(base, extendDays);
      subscription.status = 'trial';
      subscription.billingCycle = 'trial';
      await subscription.save();
    }

    if (org.status !== 'active') {
      org.status = 'trial';
      await org.save();
    }

    await this.#history({
      organizationId,
      subscriptionId: subscription._id,
      fromPlanId: subscription.planId,
      toPlanId: subscription.planId,
      action: 'trial_extended',
      billingCycle: 'trial',
      actorUserId,
      notes: `+${extendDays} días`,
      metadata: { days: extendDays, endDate: subscription.endDate },
    });

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUBSCRIPTION_AUDIT.TRIAL_EXTENDED,
      description: `Trial extendido ${extendDays} días: ${org.name}`,
      resourceId: org._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { days: extendDays, endDate: subscription.endDate },
    });

    return { organization: org, subscription, days: extendDays };
  }

  async suspend(organizationId, actorUserId, auditContext = {}, notes = '') {
    const { subscriptionLifecycle } = await import(
      '#services/subscription-engine/subscriptionLifecycle.service.js'
    );
    const result = await subscriptionLifecycle.suspend(organizationId, {
      actorUserId,
      auditContext,
      notes,
      source: 'super_admin',
    });
    return result.subscription;
  }

  async cancel(organizationId, actorUserId, auditContext = {}, notes = '') {
    const sub = await this.#requireOperational(organizationId);
    sub.status = 'cancelled';
    sub.gracePeriodEndsAt = null;
    await sub.save();

    await this.#history({
      organizationId,
      subscriptionId: sub._id,
      fromPlanId: sub.planId,
      toPlanId: sub.planId,
      action: 'cancelled',
      actorUserId,
      notes,
    });

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUBSCRIPTION_AUDIT.CANCELLED,
      description: 'Suscripción cancelada',
      resourceId: organizationId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return sub;
  }

  async renew(organizationId, actorUserId, auditContext = {}) {
    const current = await this.#requireOperational(organizationId);
    const plan = await planService.resolveActivePlanById(current.planId);

    current.status = 'expired';
    await current.save();

    const cycle = current.billingCycle === 'trial' ? 'monthly' : current.billingCycle;
    const startDate = new Date();
    const days = resolveCycleDays(cycle, {
      trialDays: (await settingsService.getSaasDefaults()).trialDays,
      planDefaultDays: plan.defaultDurationDays || plan.durationDays,
    });

    const subscription = await Subscription.create({
      organizationId,
      planId: plan._id,
      billingCycle: cycle,
      startDate,
      endDate: this.#addDays(startDate, days),
      status: 'active',
      autoRenewal: current.autoRenewal,
      amountPaid: priceForCycle(plan, cycle),
      paymentMethod: 'none',
      billingProvider: current.billingProvider || 'manual',
    });

    await this.#history({
      organizationId,
      subscriptionId: subscription._id,
      fromPlanId: plan._id,
      toPlanId: plan._id,
      action: 'renewed',
      billingCycle: cycle,
      actorUserId,
    });

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUBSCRIPTION_AUDIT.RENEWED,
      description: 'Suscripción renovada',
      resourceId: organizationId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return subscription;
  }

  async #classifyChange(fromPlanId, toPlanId) {
    if (!fromPlanId) return 'created';
    const Plan = (await import('#modules/plan/plan.model.js')).default;
    const [from, to] = await Promise.all([
      Plan.findById(fromPlanId).lean(),
      Plan.findById(toPlanId).lean(),
    ]);
    const fromPrice = from?.pricing?.monthly ?? from?.price ?? 0;
    const toPrice = to?.pricing?.monthly ?? to?.price ?? 0;
    if (toPrice > fromPrice) return 'upgraded';
    if (toPrice < fromPrice) return 'downgraded';
    return 'upgraded';
  }

  async #assertNoOperational(organizationId, session = null) {
    const existing = await Subscription.findOne({
      organizationId,
      status: { $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES] },
    }).session(session);
    if (existing) {
      throw new ApiError(409, 'La organización ya tiene una suscripción activa o en trial');
    }
  }

  async #requireOperational(organizationId) {
    const sub = await Subscription.findOne({
      organizationId,
      status: { $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES] },
    }).sort({ endDate: -1 });
    if (!sub) throw new ApiError(404, 'No hay suscripción vigente');
    return sub;
  }

  #addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  async #history(payload, session = null) {
    const doc = {
      organizationId: payload.organizationId,
      subscriptionId: payload.subscriptionId ?? null,
      fromPlanId: payload.fromPlanId ?? null,
      toPlanId: payload.toPlanId ?? null,
      action: payload.action,
      changeMode: payload.changeMode ?? 'immediate',
      billingCycle: payload.billingCycle ?? null,
      actorUserId: payload.actorUserId ?? null,
      notes: payload.notes ?? '',
      metadata: payload.metadata ?? {},
    };
    if (session) {
      await SubscriptionHistory.create([doc], { session });
    } else {
      await SubscriptionHistory.create(doc);
    }
  }
}

export const subscriptionService = new SubscriptionService();
