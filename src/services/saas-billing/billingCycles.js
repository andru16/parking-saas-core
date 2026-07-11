/**
 * Ciclos de facturación (modalidades de pago).
 * NO son planes comerciales.
 */
export const BILLING_CYCLE_DAYS = Object.freeze({
  trial: null,
  monthly: 30,
  quarterly: 90,
  semiannual: 180,
  annual: 365,
});

export const BILLING_CYCLE_LABELS = Object.freeze({
  trial: 'Trial',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
});

/** Códigos reservados: no pueden usarse como `Plan.code`. */
export const RESERVED_BILLING_CYCLE_CODES = Object.freeze([
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'mensual',
  'trimestral',
  'semestral',
  'anual',
  'mensal',
]);

export const COMMERCIAL_PLAN_CODES = Object.freeze([
  'trial',
  'starter',
  'professional',
  'enterprise',
]);

export function resolveCycleDays(billingCycle, { trialDays, planDefaultDays } = {}) {
  if (billingCycle === 'trial') {
    return trialDays || planDefaultDays || 15;
  }
  return BILLING_CYCLE_DAYS[billingCycle] || planDefaultDays || 30;
}

export function priceForCycle(plan, billingCycle) {
  if (!plan) return 0;
  if (billingCycle === 'trial') return 0;

  const fromCycles = Array.isArray(plan.billingCycles)
    ? plan.billingCycles.find((c) => c.cycle === billingCycle && c.isActive !== false)
    : null;
  if (fromCycles && fromCycles.price != null) return Number(fromCycles.price);

  const pricing = plan.pricing || {};
  const map = {
    monthly: pricing.monthly ?? plan.price ?? 0,
    quarterly: pricing.quarterly ?? 0,
    semiannual: pricing.semiannual ?? 0,
    annual: pricing.annual ?? 0,
  };
  return Number(map[billingCycle] ?? 0);
}

/**
 * Construye el subdocumento billingCycles a partir de pricing.
 */
export function billingCyclesFromPricing(pricing = {}, { includeTrial = false } = {}) {
  const cycles = [];
  if (includeTrial) {
    cycles.push({
      cycle: 'trial',
      label: BILLING_CYCLE_LABELS.trial,
      price: 0,
      durationDays: null,
      isActive: true,
    });
  }
  for (const cycle of ['monthly', 'quarterly', 'semiannual', 'annual']) {
    cycles.push({
      cycle,
      label: BILLING_CYCLE_LABELS[cycle],
      price: Number(pricing[cycle] ?? 0),
      durationDays: BILLING_CYCLE_DAYS[cycle],
      isActive: true,
    });
  }
  return cycles;
}

/**
 * Extrae pricing plano desde billingCycles[].
 */
export function pricingFromBillingCycles(billingCycles = []) {
  const pricing = { monthly: 0, quarterly: 0, semiannual: 0, annual: 0 };
  for (const row of billingCycles) {
    if (row?.cycle && row.cycle in pricing) {
      pricing[row.cycle] = Number(row.price ?? 0);
    }
  }
  return pricing;
}

export function isReservedBillingCycleCode(code) {
  return RESERVED_BILLING_CYCLE_CODES.includes(String(code || '').toLowerCase());
}

/** Infere ciclo desde un plan legacy cycle-as-plan. */
export function inferBillingCycleFromLegacyPlan(plan) {
  const code = String(plan?.code || '').toLowerCase();
  const name = String(plan?.name || '').toLowerCase();
  const map = {
    monthly: 'monthly',
    mensual: 'monthly',
    mensal: 'monthly',
    quarterly: 'quarterly',
    trimestral: 'quarterly',
    semiannual: 'semiannual',
    semestral: 'semiannual',
    annual: 'annual',
    anual: 'annual',
  };
  if (map[code]) return map[code];
  for (const [key, cycle] of Object.entries(map)) {
    if (name.includes(key)) return cycle;
  }
  return 'monthly';
}
