import Plan from '#modules/plan/plan.model.js';
import Subscription from '#modules/subscription/subscription.model.js';
import SubscriptionHistory from '#modules/subscription/subscriptionHistory.model.js';
import {
  COMMERCIAL_PLAN_CODES,
  inferBillingCycleFromLegacyPlan,
  RESERVED_BILLING_CYCLE_CODES,
} from '#services/saas-billing/billingCycles.js';
import { OPERATIONAL_SUBSCRIPTION_STATUSES } from '#modules/subscription/subscription.model.js';

const LEGACY_NAME_REGEX = /^(mensual|trimestral|semestral|anual|monthly|quarterly|semiannual|annual)$/i;

/**
 * Migra Organizations fuera de planes cycle-as-plan (Mensual, Trimestral, …)
 * hacia planes comerciales (por defecto Starter), preservando fechas y ciclo.
 */
export async function migrateLegacyCyclePlans() {
  const legacyPlans = await Plan.find({
    $or: [
      { code: { $in: [...RESERVED_BILLING_CYCLE_CODES] } },
      { name: LEGACY_NAME_REGEX },
      {
        code: { $nin: [...COMMERCIAL_PLAN_CODES] },
        name: { $regex: /mensual|trimestral|semestral|anual/i },
      },
    ],
  }).lean();

  if (!legacyPlans.length) {
    return { migratedSubscriptions: 0, deactivatedPlans: 0 };
  }

  const starter = await Plan.findOne({ code: 'starter', isActive: true });
  if (!starter) {
    console.warn('[migrateLegacyCyclePlans] Plan Starter no encontrado; se omite migración');
    return { migratedSubscriptions: 0, deactivatedPlans: 0 };
  }

  const legacyIds = legacyPlans.map((p) => p._id);
  const legacyById = new Map(legacyPlans.map((p) => [String(p._id), p]));

  const subs = await Subscription.find({
    planId: { $in: legacyIds },
  });

  let migratedSubscriptions = 0;

  for (const sub of subs) {
    const legacy = legacyById.get(String(sub.planId));
    if (!legacy) continue;

    const billingCycle =
      sub.billingCycle && sub.billingCycle !== 'trial'
        ? sub.billingCycle
        : inferBillingCycleFromLegacyPlan(legacy);

    const previousPlanId = sub.planId;
    sub.planId = starter._id;
    sub.billingCycle = billingCycle === 'trial' ? 'monthly' : billingCycle;
    if (!sub.notes) {
      sub.notes = `Migrado desde plan legacy "${legacy.name}" (${legacy.code})`;
    }
    await sub.save();

    await SubscriptionHistory.create({
      organizationId: sub.organizationId,
      subscriptionId: sub._id,
      fromPlanId: previousPlanId,
      toPlanId: starter._id,
      action: 'upgraded',
      changeMode: 'immediate',
      billingCycle: sub.billingCycle,
      actorUserId: null,
      notes: 'Migración automática: plan cycle-as-plan → Starter',
      metadata: {
        legacyPlanCode: legacy.code,
        legacyPlanName: legacy.name,
        operational: OPERATIONAL_SUBSCRIPTION_STATUSES.includes(sub.status),
      },
    });

    migratedSubscriptions += 1;
  }

  let deactivatedPlans = 0;
  for (const legacy of legacyPlans) {
    const newCode = legacy.code.startsWith('legacy_')
      ? legacy.code
      : `legacy_${legacy.code}`.slice(0, 40);

    await Plan.updateOne(
      { _id: legacy._id },
      {
        $set: {
          isActive: false,
          isTrialPlan: false,
          isRecommended: false,
          code: newCode,
          name: `[Legacy] ${legacy.name} (${legacy.code})`.slice(0, 80),
          description: `Plan obsoleto (ciclo de cobro como plan). Migrado automáticamente. Original: ${legacy.code}`,
        },
      },
    );
    deactivatedPlans += 1;
  }

  return { migratedSubscriptions, deactivatedPlans, legacyPlanIds: legacyIds.map(String) };
}
