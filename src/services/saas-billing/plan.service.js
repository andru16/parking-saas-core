import Plan from '#modules/plan/plan.model.js';
import PlanFeature from '#modules/plan/planFeature.model.js';
import Organization from '#modules/organization/organization.model.js';
import Subscription, {
  OPERATIONAL_SUBSCRIPTION_STATUSES,
} from '#modules/subscription/subscription.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import {
  SUPER_ADMIN_AUDIT_MODULE,
} from '#modules/superAdmin/permissions.catalog.js';
import {
  billingCyclesFromPricing,
  isReservedBillingCycleCode,
  COMMERCIAL_PLAN_CODES,
} from './billingCycles.js';

export { COMMERCIAL_PLAN_CODES };

export const PLAN_AUDIT_ACTIONS = Object.freeze({
  CREATED: 'sa_plan_created',
  UPDATED: 'sa_plan_updated',
  ACTIVATED: 'sa_plan_activated',
  DEACTIVATED: 'sa_plan_deactivated',
  DUPLICATED: 'sa_plan_duplicated',
});

/**
 * Administración del catálogo de planes SaaS.
 */
export class PlanService {
  async listFeatures() {
    return PlanFeature.find({ isActive: true }).sort({ sortOrder: 1, label: 1 }).lean();
  }

  async listAllFeatures() {
    return PlanFeature.find({}).sort({ sortOrder: 1, label: 1 }).lean();
  }

  async list({ includeInactive = true, commercialOnly = true } = {}) {
    const filter = {};
    if (!includeInactive) filter.isActive = true;
    if (commercialOnly) {
      filter.code = { $in: [...COMMERCIAL_PLAN_CODES] };
    }

    const plans = await Plan.find(filter).sort({ sortOrder: 1, name: 1 }).lean();

    const counts = await Subscription.aggregate([
      { $match: { status: { $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES] } } },
      { $group: { _id: '$planId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    return plans.map((p) => this.#toResponse(p, countMap.get(String(p._id)) ?? 0));
  }

  /**
   * Catálogo público para landing / marketing (sin auth).
   * Solo planes activos comerciales, con labels de features habilitadas.
   */
  async listPublicCatalog() {
    const [plans, featureDefs] = await Promise.all([
      this.list({ includeInactive: false, commercialOnly: true }),
      this.listFeatures(),
    ]);

    const labelByKey = new Map(featureDefs.map((f) => [f.key, f.label]));

    return plans.map((plan) => {
      const featureKeys = Object.entries(plan.features || {})
        .filter(([, enabled]) => Boolean(enabled))
        .map(([key]) => key);

      const featureLabels = featureKeys
        .map((key) => labelByKey.get(key) ?? key)
        .filter(Boolean);

      // Añade límites legibles como bullets de marketing.
      const limitBullets = [];
      if (plan.limits?.maxSites != null) {
        limitBullets.push(
          plan.limits.maxSites === 1
            ? '1 sede / estacionamiento'
            : `Hasta ${plan.limits.maxSites} sedes`,
        );
      } else if (!plan.isTrialPlan) {
        limitBullets.push('Sedes ilimitadas');
      }
      if (plan.limits?.maxUsers != null) {
        limitBullets.push(`Hasta ${plan.limits.maxUsers} usuarios`);
      } else if (!plan.isTrialPlan) {
        limitBullets.push('Usuarios ilimitados');
      }
      if (plan.limits?.maxCashRegisters != null) {
        limitBullets.push(`Hasta ${plan.limits.maxCashRegisters} cajas`);
      }

      const highlights = [...new Set([...limitBullets, ...featureLabels])].slice(0, 8);

      return {
        id: plan.id,
        name: plan.name,
        code: plan.code,
        description: plan.description,
        isTrialPlan: plan.isTrialPlan,
        isRecommended: plan.isRecommended,
        currency: plan.currency,
        sortOrder: plan.sortOrder,
        color: plan.color,
        pricing: plan.pricing,
        billingCycles: (plan.billingCycles || []).filter((c) => c.isActive !== false),
        features: highlights,
        cta: plan.isTrialPlan ? 'Crear cuenta gratis' : 'Comenzar ahora',
      };
    });
  }

  async getById(planId) {
    const plan = await Plan.findById(planId).lean();
    if (!plan) throw new ApiError(404, 'Plan no encontrado');

    const orgs = await this.listOrganizationsUsingPlan(planId);
    return {
      plan: this.#toResponse(plan, orgs.length),
      organizations: orgs,
    };
  }

  async listOrganizationsUsingPlan(planId) {
    const subs = await Subscription.find({
      planId,
      status: { $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES] },
    })
      .select('organizationId endDate status billingCycle')
      .lean();

    const orgIds = subs.map((s) => s.organizationId);
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select('name email status city country')
      .lean();

    const orgMap = new Map(orgs.map((o) => [String(o._id), o]));

    return subs
      .map((s) => {
        const org = orgMap.get(String(s.organizationId));
        if (!org) return null;
        return {
          id: org._id.toString(),
          name: org.name,
          email: org.email ?? null,
          status: org.status,
          city: org.city ?? null,
          subscriptionStatus: s.status,
          billingCycle: s.billingCycle,
          endDate: s.endDate,
        };
      })
      .filter(Boolean);
  }

  async create(payload, actorUserId, auditContext = {}) {
    await this.#assertFeaturesValid(payload.features);
    const code = String(payload.code).trim().toLowerCase();
    this.#assertCommercialCode(code);

    const exists = await Plan.findOne({ $or: [{ code }, { name: payload.name.trim() }] });
    if (exists) throw new ApiError(409, 'Ya existe un plan con ese nombre o código');

    if (payload.isTrialPlan) {
      await Plan.updateMany({ isTrialPlan: true }, { $set: { isTrialPlan: false } });
    }

    if (payload.isRecommended) {
      await Plan.updateMany({ isRecommended: true }, { $set: { isRecommended: false } });
    }

    const plan = await Plan.create(this.#normalizePayload(payload));

    await auditService.log({
      userId: actorUserId,
      organizationId: null,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: PLAN_AUDIT_ACTIONS.CREATED,
      description: `Plan creado: ${plan.name}`,
      resourceId: plan._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.#toResponse(plan.toObject());
  }

  async update(planId, payload, actorUserId, auditContext = {}) {
    const plan = await Plan.findById(planId);
    if (!plan) throw new ApiError(404, 'Plan no encontrado');

    if (payload.features) await this.#assertFeaturesValid(payload.features);

    if (payload.code && payload.code !== plan.code) {
      const nextCode = String(payload.code).trim().toLowerCase();
      this.#assertCommercialCode(nextCode);
      const clash = await Plan.findOne({ code: nextCode });
      if (clash) throw new ApiError(409, 'Código de plan ya en uso');
    }

    if (payload.name && payload.name !== plan.name) {
      const clash = await Plan.findOne({ name: payload.name.trim() });
      if (clash) throw new ApiError(409, 'Nombre de plan ya en uso');
    }

    if (payload.isTrialPlan === true) {
      await Plan.updateMany(
        { _id: { $ne: plan._id }, isTrialPlan: true },
        { $set: { isTrialPlan: false } },
      );
    }

    if (payload.isRecommended === true) {
      await Plan.updateMany(
        { _id: { $ne: plan._id }, isRecommended: true },
        { $set: { isRecommended: false } },
      );
    }

    const normalized = this.#normalizePayload({ ...plan.toObject(), ...payload });
    Object.assign(plan, normalized);
    await plan.save();

    await auditService.log({
      userId: actorUserId,
      organizationId: null,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: PLAN_AUDIT_ACTIONS.UPDATED,
      description: `Plan actualizado: ${plan.name}`,
      resourceId: plan._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.#toResponse(plan.toObject());
  }

  async setActive(planId, isActive, actorUserId, auditContext = {}) {
    const plan = await Plan.findById(planId);
    if (!plan) throw new ApiError(404, 'Plan no encontrado');

    if (!isActive && plan.isTrialPlan) {
      throw new ApiError(400, 'No se puede desactivar el plan Trial de la plataforma');
    }

    plan.isActive = Boolean(isActive);
    await plan.save();

    await auditService.log({
      userId: actorUserId,
      organizationId: null,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: isActive ? PLAN_AUDIT_ACTIONS.ACTIVATED : PLAN_AUDIT_ACTIONS.DEACTIVATED,
      description: `Plan ${isActive ? 'activado' : 'desactivado'}: ${plan.name}`,
      resourceId: plan._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.#toResponse(plan.toObject());
  }

  async duplicate(planId, actorUserId, auditContext = {}) {
    const source = await Plan.findById(planId).lean();
    if (!source) throw new ApiError(404, 'Plan no encontrado');

    const baseCode = `${source.code}_copy`;
    let code = baseCode;
    let i = 1;
    while (await Plan.exists({ code })) {
      code = `${baseCode}_${i++}`;
    }

    const name = `${source.name} (copia)`;
    const features =
      source.features instanceof Map
        ? Object.fromEntries(source.features)
        : { ...(source.features || {}) };

    const plan = await Plan.create({
      ...source,
      _id: undefined,
      name,
      code,
      isTrialPlan: false,
      isActive: false,
      features,
      createdAt: undefined,
      updatedAt: undefined,
    });

    await auditService.log({
      userId: actorUserId,
      organizationId: null,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: PLAN_AUDIT_ACTIONS.DUPLICATED,
      description: `Plan duplicado desde ${source.code}: ${plan.code}`,
      resourceId: plan._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { sourcePlanId: source._id },
    });

    return this.#toResponse(plan.toObject());
  }

  async resolveTrialPlan(session = null) {
    const plan = await Plan.findOne({ isTrialPlan: true, isActive: true }).session(session);
    if (plan) return plan;

    const byCode = await Plan.findOne({ code: 'trial', isActive: true }).session(session);
    if (!byCode) {
      throw new ApiError(500, 'No hay plan Trial configurado. Créelo en Super Admin → Planes.');
    }
    return byCode;
  }

  async resolveActivePlanById(planId, session = null) {
    const plan = await Plan.findById(planId).session(session);
    if (!plan) throw new ApiError(404, 'El plan indicado no existe');
    if (!plan.isActive) throw new ApiError(400, 'El plan indicado no está activo');
    return plan;
  }

  async resolveActivePlanByCode(code, session = null) {
    const normalized = String(code ?? '')
      .trim()
      .toLowerCase();
    if (!normalized) throw new ApiError(400, 'Código de plan inválido');
    const plan = await Plan.findOne({ code: normalized, isActive: true }).session(session);
    if (!plan) throw new ApiError(404, `No hay plan activo con código "${normalized}"`);
    return plan;
  }

  #normalizePayload(payload) {
    const pricing = {
      monthly: Number(payload.pricing?.monthly ?? payload.price ?? 0),
      quarterly: Number(payload.pricing?.quarterly ?? 0),
      semiannual: Number(payload.pricing?.semiannual ?? 0),
      annual: Number(payload.pricing?.annual ?? 0),
    };

    const limits = {
      maxUsers: this.#nullLimit(payload.limits?.maxUsers),
      maxCashRegisters: this.#nullLimit(payload.limits?.maxCashRegisters),
      maxSites: this.#nullLimit(payload.limits?.maxSites),
      maxActiveVehicles: this.#nullLimit(payload.limits?.maxActiveVehicles),
      maxDailyTickets: this.#nullLimit(payload.limits?.maxDailyTickets),
    };

    let features = payload.features ?? {};
    if (features instanceof Map) features = Object.fromEntries(features);

    const isTrialPlan = Boolean(payload.isTrialPlan);
    const billingCycles = Array.isArray(payload.billingCycles) && payload.billingCycles.length
      ? payload.billingCycles
      : billingCyclesFromPricing(pricing, { includeTrial: isTrialPlan });

    return {
      name: String(payload.name).trim(),
      code: String(payload.code).trim().toLowerCase(),
      description: payload.description?.trim() ?? '',
      isActive: payload.isActive !== false,
      isTrialPlan,
      isRecommended: Boolean(payload.isRecommended),
      pricing,
      billingCycles,
      currency: (payload.currency || 'COP').toUpperCase(),
      sortOrder: Number(payload.sortOrder ?? 0),
      color: payload.color || '#0f766e',
      icon: {
        name: payload.icon?.name ?? null,
        url: payload.icon?.url ?? null,
      },
      limits,
      features,
      defaultDurationDays: Number(
        payload.defaultDurationDays ?? payload.durationDays ?? 30,
      ),
      price: pricing.monthly,
      durationDays: Number(payload.defaultDurationDays ?? payload.durationDays ?? 30),
    };
  }

  #nullLimit(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  #assertCommercialCode(code) {
    if (isReservedBillingCycleCode(code)) {
      throw new ApiError(
        400,
        `«${code}» es un ciclo de facturación, no un plan. Use trial, starter, professional o enterprise.`,
      );
    }
  }

  async #assertFeaturesValid(features) {
    if (!features) return;
    const obj = features instanceof Map ? Object.fromEntries(features) : features;
    const keys = Object.keys(obj);
    if (!keys.length) return;

    const known = await PlanFeature.find({ key: { $in: keys } }).select('key').lean();
    const knownSet = new Set(known.map((f) => f.key));
    const unknown = keys.filter((k) => !knownSet.has(k));
    if (unknown.length) {
      throw new ApiError(400, `Features desconocidas: ${unknown.join(', ')}`);
    }
  }

  #toResponse(plan, organizationsCount = 0) {
    const features =
      plan.features instanceof Map
        ? Object.fromEntries(plan.features)
        : { ...(plan.features || {}) };

    const pricing = {
      monthly: plan.pricing?.monthly ?? plan.price ?? 0,
      quarterly: plan.pricing?.quarterly ?? 0,
      semiannual: plan.pricing?.semiannual ?? 0,
      annual: plan.pricing?.annual ?? 0,
    };

    const billingCycles =
      Array.isArray(plan.billingCycles) && plan.billingCycles.length
        ? plan.billingCycles.map((c) => ({
            cycle: c.cycle,
            label: c.label,
            price: c.price,
            durationDays: c.durationDays,
            isActive: c.isActive !== false,
          }))
        : billingCyclesFromPricing(pricing, { includeTrial: Boolean(plan.isTrialPlan) });

    return {
      id: plan._id.toString(),
      name: plan.name,
      code: plan.code,
      description: plan.description ?? '',
      isActive: plan.isActive,
      isTrialPlan: Boolean(plan.isTrialPlan),
      isRecommended: Boolean(plan.isRecommended),
      pricing,
      billingCycles,
      currency: plan.currency ?? 'COP',
      sortOrder: plan.sortOrder ?? 0,
      color: plan.color ?? '#0f766e',
      icon: plan.icon ?? { name: null, url: null },
      limits: {
        maxUsers: plan.limits?.maxUsers ?? null,
        maxCashRegisters: plan.limits?.maxCashRegisters ?? null,
        maxSites: plan.limits?.maxSites ?? null,
        maxActiveVehicles: plan.limits?.maxActiveVehicles ?? null,
        maxDailyTickets: plan.limits?.maxDailyTickets ?? null,
      },
      features,
      defaultDurationDays: plan.defaultDurationDays ?? plan.durationDays ?? 30,
      organizationsCount,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}

export const planService = new PlanService();
