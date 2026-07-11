import Organization from '#modules/organization/organization.model.js';
import Subscription, {
  OPERATIONAL_SUBSCRIPTION_STATUSES,
} from '#modules/subscription/subscription.model.js';
import User from '#modules/user/user.model.js';
import Ticket from '#modules/ticket/ticket.model.js';
import Vehicle from '#modules/vehicle/vehicle.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { subscriptionService } from '#services/saas-billing/subscription.service.js';
import {
  SUPER_ADMIN_AUDIT_ACTIONS,
  SUPER_ADMIN_AUDIT_MODULE,
} from './permissions.catalog.js';

const STATUS_ACTIONS = Object.freeze({
  activate: { status: 'active', audit: SUPER_ADMIN_AUDIT_ACTIONS.ORG_ACTIVATED },
  suspend: { status: 'suspended', audit: SUPER_ADMIN_AUDIT_ACTIONS.ORG_SUSPENDED },
  reactivate: { status: 'active', audit: SUPER_ADMIN_AUDIT_ACTIONS.ORG_REACTIVATED },
  trial: { status: 'trial', audit: SUPER_ADMIN_AUDIT_ACTIONS.ORG_ACTIVATED },
});

/**
 * Administración de Organizations desde la plataforma (sin lógica operativa del parqueadero).
 */
export class SuperAdminOrganizationsService {
  async list({ search, status, page = 1, limit = 20 } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (search?.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { city: { $regex: q, $options: 'i' } },
        { taxId: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const take = Math.min(100, Math.max(1, limit));

    const [items, total] = await Promise.all([
      Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).lean(),
      Organization.countDocuments(filter),
    ]);

    const orgIds = items.map((o) => o._id);
    const subs = await Subscription.find({
      organizationId: { $in: orgIds },
      status: {
        $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES, 'suspended', 'expired'],
      },
    })
      .populate('planId', 'name code pricing price color isTrialPlan')
      .sort({ updatedAt: -1 })
      .lean();

    const subByOrg = new Map();
    for (const s of subs) {
      const key = s.organizationId.toString();
      if (!subByOrg.has(key)) subByOrg.set(key, s);
    }

    return {
      organizations: items.map((o) => this.#toListItem(o, subByOrg.get(o._id.toString()))),
      pagination: {
        page: Math.max(1, page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  async getById(organizationId, actorUserId, auditContext = {}) {
    const org = await Organization.findById(organizationId).lean();
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    const [subscription, usersCount, vehiclesCount, ticketsCount, lastUserLogin, users] =
      await Promise.all([
        Subscription.findOne({
          organizationId,
          status: {
            $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES, 'suspended', 'expired', 'cancelled'],
          },
        })
          .populate('planId', 'name code pricing price durationDays defaultDurationDays isTrialPlan color')
          .sort({ updatedAt: -1 })
          .lean(),
        User.countDocuments({ organizationId }),
        Vehicle.countDocuments({ organizationId }),
        Ticket.countDocuments({ organizationId }),
        User.findOne({ organizationId })
          .sort({ lastLoginAt: -1 })
          .select('lastLoginAt firstName lastName email')
          .lean(),
        User.find({ organizationId })
          .select('firstName lastName email status lastLoginAt phone organizationRoleId')
          .populate('organizationRoleId', 'key name')
          .sort({ createdAt: 1 })
          .limit(50)
          .lean(),
      ]);

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUPER_ADMIN_AUDIT_ACTIONS.ORG_VIEWED,
      description: `Detalle organización: ${org.name}`,
      resourceId: org._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return {
      organization: this.#toDetail(org),
      subscription: subscription
        ? {
            id: subscription._id.toString(),
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            billingCycleLabel:
              {
                trial: 'Trial',
                monthly: 'Mensual',
                quarterly: 'Trimestral',
                semiannual: 'Semestral',
                annual: 'Anual',
              }[subscription.billingCycle] ?? subscription.billingCycle,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            nextRenewalAt: subscription.endDate,
            gracePeriodEndsAt: subscription.gracePeriodEndsAt ?? null,
            amountPaid: subscription.amountPaid,
            autoRenewal: subscription.autoRenewal,
            plan: subscription.planId
              ? {
                  id: subscription.planId._id.toString(),
                  name: subscription.planId.name,
                  code: subscription.planId.code,
                  price: subscription.planId.pricing?.monthly ?? subscription.planId.price,
                  pricing: subscription.planId.pricing,
                  durationDays:
                    subscription.planId.defaultDurationDays ?? subscription.planId.durationDays,
                  color: subscription.planId.color,
                  isTrialPlan: subscription.planId.isTrialPlan,
                  isRecommended: Boolean(subscription.planId.isRecommended),
                }
              : null,
          }
        : null,
      subscriptionHistory: await subscriptionService.listHistory(organizationId, { limit: 30 }),
      stats: {
        usersCount,
        vehiclesCount,
        ticketsCount,
        lastAccessAt: lastUserLogin?.lastLoginAt ?? null,
        lastAccessUser: lastUserLogin
          ? {
              name: `${lastUserLogin.firstName} ${lastUserLogin.lastName}`,
              email: lastUserLogin.email,
            }
          : null,
      },
      users: users.map((u) => ({
        id: u._id.toString(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone ?? null,
        status: u.status,
        lastLoginAt: u.lastLoginAt ?? null,
        role: u.organizationRoleId
          ? { key: u.organizationRoleId.key, name: u.organizationRoleId.name }
          : null,
      })),
      /** Estructura preparada para historial de pagos SaaS */
      paymentHistory: {
        items: [],
        prepared: true,
        note: 'Historial de pagos de suscripción — pendiente de módulo de billing',
      },
      /** Prep. soporte / incidencias / multi-región */
      support: {
        region: org.country || null,
        locale: 'es',
        currency: 'COP',
        openIncidents: 0,
      },
    };
  }

  async changeStatus(organizationId, action, actorUserId, auditContext = {}) {
    const mapping = STATUS_ACTIONS[action];
    if (!mapping) throw new ApiError(400, 'Acción de estado inválida');

    const { subscriptionLifecycle } = await import(
      '#services/subscription-engine/subscriptionLifecycle.service.js'
    );
    const { LIFECYCLE_SOURCES } = await import('#services/subscription-engine/constants.js');

    if (action === 'suspend') {
      const result = await subscriptionLifecycle.suspend(organizationId, {
        source: LIFECYCLE_SOURCES.SUPER_ADMIN,
        actorUserId,
        auditContext,
        reason: 'manual_super_admin',
      });
      return this.#toDetail(result.organization.toObject());
    }

    if (action === 'reactivate' || action === 'activate') {
      const result =
        action === 'reactivate'
          ? await subscriptionLifecycle.reactivate(organizationId, {
              source: LIFECYCLE_SOURCES.SUPER_ADMIN,
              actorUserId,
              auditContext,
            })
          : await subscriptionLifecycle.activate(organizationId, {
              source: LIFECYCLE_SOURCES.SUPER_ADMIN,
              actorUserId,
              auditContext,
            });
      return this.#toDetail(result.organization.toObject());
    }

    const org = await Organization.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    const previous = org.status;
    org.status = mapping.status;
    await org.save();

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: mapping.audit,
      description: `Estado organización ${org.name}: ${previous} → ${org.status}`,
      resourceId: org._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { previous, next: org.status, action },
    });

    return this.#toDetail(org.toObject());
  }

  async extendTrial(organizationId, { days }, actorUserId, auditContext = {}) {
    const result = await subscriptionService.extendTrial(
      organizationId,
      { days },
      actorUserId,
      auditContext,
    );
    return {
      organization: this.#toDetail(result.organization.toObject()),
      subscription: {
        id: result.subscription._id.toString(),
        endDate: result.subscription.endDate,
        status: result.subscription.status,
      },
    };
  }

  async changePlan(organizationId, payload, actorUserId, auditContext = {}) {
    const result = await subscriptionService.changePlan(
      organizationId,
      {
        planId: payload.planId,
        billingCycle: payload.billingCycle || 'monthly',
        changeMode: payload.changeMode || 'immediate',
        scheduledAt: payload.scheduledAt || null,
        notes: payload.notes || '',
      },
      actorUserId,
      auditContext,
    );

    const org =
      result.organization?.toObject?.() ??
      (await Organization.findById(organizationId).lean());

    return {
      mode: result.mode,
      organization: this.#toDetail(org),
      subscription: {
        id: result.subscription._id.toString(),
        startDate: result.subscription.startDate,
        endDate: result.subscription.endDate,
        status: result.subscription.status,
        billingCycle: result.subscription.billingCycle,
        plan: {
          id: result.plan._id.toString(),
          name: result.plan.name,
          code: result.plan.code,
          price: result.plan.pricing?.monthly ?? result.plan.price,
        },
      },
    };
  }

  #toListItem(org, subscription) {
    return {
      id: org._id.toString(),
      name: org.name,
      email: org.email ?? null,
      city: org.city ?? null,
      country: org.country ?? null,
      status: org.status,
      isSetupComplete: org.isSetupComplete,
      createdAt: org.createdAt,
      subscription: subscription
        ? {
            endDate: subscription.endDate,
            status: subscription.status,
            planName: subscription.planId?.name ?? null,
            planCode: subscription.planId?.code ?? null,
          }
        : null,
    };
  }

  #toDetail(org) {
    return {
      id: org._id.toString(),
      name: org.name,
      legalName: org.legalName ?? null,
      email: org.email ?? null,
      phone: org.phone ?? null,
      city: org.city ?? null,
      stateOrDepartment: org.stateOrDepartment ?? null,
      country: org.country ?? null,
      taxId: org.taxId ?? null,
      address: org.address ?? null,
      status: org.status,
      isSetupComplete: org.isSetupComplete,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }
}

export const superAdminOrganizationsService = new SuperAdminOrganizationsService();
