import Role from '#modules/role/role.model.js';
import Plan from '#modules/plan/plan.model.js';
import PlanFeature from '#modules/plan/planFeature.model.js';
import { ROLES } from '#modules/auth/constants.js';
import env from '#config/env.js';
import { billingCyclesFromPricing } from '#services/saas-billing/billingCycles.js';
import { migrateLegacyCyclePlans } from '#database/migrations/migrateLegacyCyclePlans.js';

const ROLES_SEED = [
  {
    name: ROLES.SUPER_ADMIN,
    displayName: 'Super Administrador',
    description: 'Administración global de la plataforma',
    permissions: ['*'],
    isPlatformRole: true,
  },
  {
    name: ROLES.ORGANIZATION_ADMIN,
    displayName: 'Administrador de Organización',
    description: 'Administración completa del parqueadero',
    permissions: [],
    isPlatformRole: false,
  },
  {
    name: ROLES.SUPERVISOR,
    displayName: 'Supervisor',
    description: 'Supervisión operativa, reportes y configuración parcial',
    permissions: [],
    isPlatformRole: false,
  },
  {
    name: ROLES.CASHIER,
    displayName: 'Cajero',
    description: 'Operación diaria de tickets, pagos y caja',
    permissions: [],
    isPlatformRole: false,
  },
];

/**
 * Catálogo de features (funcionalidades).
 * No se usan para limitar vehículos/tickets/operación.
 */
const FEATURES_SEED = [
  { key: 'dashboard', label: 'Dashboard', category: 'core', sortOrder: 10 },
  { key: 'tickets', label: 'Tickets', category: 'core', sortOrder: 20 },
  { key: 'vehicles', label: 'Vehículos', category: 'core', sortOrder: 30 },
  { key: 'cash', label: 'Caja', category: 'ops', sortOrder: 40 },
  { key: 'payments', label: 'Pagos', category: 'ops', sortOrder: 50 },
  { key: 'settings', label: 'Configuración', category: 'ops', sortOrder: 60 },
  { key: 'printing', label: 'Impresión', category: 'ops', sortOrder: 70 },
  { key: 'reports', label: 'Reportes básicos', category: 'analytics', sortOrder: 80 },
  { key: 'reports_advanced', label: 'Reportes avanzados', category: 'analytics', sortOrder: 90 },
  { key: 'memberships', label: 'Membresías', category: 'ops', sortOrder: 100 },
  { key: 'agreements', label: 'Convenios', category: 'ops', sortOrder: 110 },
  { key: 'audit', label: 'Auditoría', category: 'security', sortOrder: 120 },
  { key: 'export_excel', label: 'Exportar Excel', category: 'exports', sortOrder: 130 },
  { key: 'export_pdf', label: 'Exportar PDF', category: 'exports', sortOrder: 140 },
  { key: 'notifications', label: 'Notificaciones', category: 'comms', sortOrder: 150 },
  { key: 'api', label: 'API', category: 'integrations', sortOrder: 160 },
  { key: 'integrations', label: 'Integraciones', category: 'integrations', sortOrder: 170 },
  { key: 'multi_site', label: 'Multi-sede', category: 'integrations', sortOrder: 180 },
  { key: 'priority_support', label: 'Soporte prioritario', category: 'support', sortOrder: 190 },
];

function featuresMap(enabledKeys) {
  const set = new Set(enabledKeys);
  return Object.fromEntries(FEATURES_SEED.map((f) => [f.key, set.has(f.key)]));
}

function allFeaturesOn() {
  return Object.fromEntries(FEATURES_SEED.map((f) => [f.key, true]));
}

const STARTER_FEATURES = [
  'dashboard',
  'tickets',
  'vehicles',
  'cash',
  'payments',
  'settings',
  'printing',
  'reports',
  'notifications',
];

const PROFESSIONAL_FEATURES = [
  ...STARTER_FEATURES,
  'memberships',
  'agreements',
  'reports_advanced',
  'export_excel',
  'export_pdf',
  'audit',
];

/**
 * Inserta/actualiza roles, features y planes comerciales canónicos.
 * Los ciclos Mensual/Trimestral/… NO son planes.
 */
export async function seedRolesAndPlans() {
  for (const role of ROLES_SEED) {
    await Role.updateOne({ name: role.name }, { $setOnInsert: role }, { upsert: true });
  }

  for (const feature of FEATURES_SEED) {
    await PlanFeature.updateOne(
      { key: feature.key },
      {
        $set: {
          label: feature.label,
          category: feature.category,
          sortOrder: feature.sortOrder,
          isActive: true,
        },
        $setOnInsert: { description: '' },
      },
      { upsert: true },
    );
  }

  const trialDays = env.trial.durationDays;

  const plans = [
    {
      name: 'Trial',
      code: 'trial',
      description:
        'Prueba gratuita durante 15 días con acceso completo a todas las funcionalidades.',
      isTrialPlan: true,
      isRecommended: false,
      isActive: true,
      sortOrder: 0,
      color: '#22c55e',
      currency: 'COP',
      pricing: { monthly: 0, quarterly: 0, semiannual: 0, annual: 0 },
      defaultDurationDays: trialDays,
      durationDays: trialDays,
      price: 0,
      limits: {
        maxUsers: null,
        maxCashRegisters: null,
        maxSites: 1,
        maxActiveVehicles: null,
        maxDailyTickets: null,
      },
      features: allFeaturesOn(),
    },
    {
      name: 'Starter',
      code: 'starter',
      description:
        'Ideal para parqueaderos pequeños que buscan controlar ingresos, salidas y caja de forma sencilla.',
      isTrialPlan: false,
      isRecommended: false,
      isActive: true,
      sortOrder: 10,
      color: '#22c55e',
      currency: 'COP',
      pricing: {
        monthly: 49900,
        quarterly: 142000,
        semiannual: 269000,
        annual: 479000,
      },
      defaultDurationDays: 30,
      durationDays: 30,
      price: 49900,
      limits: {
        maxUsers: 2,
        maxCashRegisters: 1,
        maxSites: 1,
        maxActiveVehicles: null,
        maxDailyTickets: null,
      },
      features: featuresMap(STARTER_FEATURES),
    },
    {
      name: 'Professional',
      code: 'professional',
      description:
        'Ideal para la mayoría de parqueaderos. Incluye membresías, reportes avanzados y herramientas administrativas.',
      isTrialPlan: false,
      isRecommended: true,
      isActive: true,
      sortOrder: 20,
      color: '#2563eb',
      currency: 'COP',
      pricing: {
        monthly: 69900,
        quarterly: 199000,
        semiannual: 379000,
        annual: 669000,
      },
      defaultDurationDays: 30,
      durationDays: 30,
      price: 69900,
      limits: {
        maxUsers: 5,
        maxCashRegisters: 3,
        maxSites: 1,
        maxActiveVehicles: null,
        maxDailyTickets: null,
      },
      features: featuresMap(PROFESSIONAL_FEATURES),
    },
    {
      name: 'Enterprise',
      code: 'enterprise',
      description:
        'Pensado para empresas que requieren todas las funcionalidades disponibles y futuras integraciones.',
      isTrialPlan: false,
      isRecommended: false,
      isActive: true,
      sortOrder: 30,
      color: '#7c3aed',
      currency: 'COP',
      pricing: {
        monthly: 79900,
        quarterly: 228000,
        semiannual: 429000,
        annual: 769000,
      },
      defaultDurationDays: 30,
      durationDays: 30,
      price: 79900,
      limits: {
        maxUsers: null,
        maxCashRegisters: null,
        maxSites: null,
        maxActiveVehicles: null,
        maxDailyTickets: null,
      },
      features: allFeaturesOn(),
    },
  ];

  for (const plan of plans) {
    const billingCycles = billingCyclesFromPricing(plan.pricing, {
      includeTrial: plan.isTrialPlan,
    });

    await Plan.updateOne(
      { code: plan.code },
      {
        $set: {
          name: plan.name,
          description: plan.description,
          isTrialPlan: plan.isTrialPlan,
          isRecommended: plan.isRecommended,
          isActive: plan.isActive,
          sortOrder: plan.sortOrder,
          color: plan.color,
          currency: plan.currency,
          pricing: plan.pricing,
          billingCycles,
          defaultDurationDays: plan.defaultDurationDays,
          durationDays: plan.durationDays,
          price: plan.price,
          limits: plan.limits,
          features: plan.features,
        },
        $setOnInsert: { icon: { name: null, url: null } },
      },
      { upsert: true },
    );
  }

  // Solo un trial y un recommended
  const trials = await Plan.find({ isTrialPlan: true }).sort({ createdAt: 1 });
  if (trials.length > 1) {
    for (const extra of trials.slice(1)) {
      extra.isTrialPlan = false;
      await extra.save();
    }
  }

  await Plan.updateMany(
    { code: { $ne: 'professional' }, isRecommended: true },
    { $set: { isRecommended: false } },
  );

  const migration = await migrateLegacyCyclePlans();
  if (migration.migratedSubscriptions > 0 || migration.deactivatedPlans > 0) {
    console.log(
      `[planes] Migración legacy: ${migration.migratedSubscriptions} suscripciones, ${migration.deactivatedPlans} planes desactivados`,
    );
  }
}
