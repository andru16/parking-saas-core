/**
 * Constantes del módulo System Settings.
 */

export const PLATFORM_SETTINGS_KEY = 'global';

export const DEFAULT_PLATFORM_SETTINGS = Object.freeze({
  branding: {
    platformName: 'Parking SaaS',
    logoUrl: null,
    faviconUrl: null,
    primaryColor: '#0f766e',
    secondaryColor: '#134e4a',
  },
  maintenance: {
    enabled: false,
    message: 'La plataforma está en mantenimiento. Intente más tarde.',
  },
  security: {
    maxSessionMinutes: 480,
    maxLoginAttempts: 10,
    loginWindowMinutes: 15,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: false,
  },
  saas: {
    defaultTrialDays: 15,
    trialPremiumDays: 3,
    gracePeriodDays: 5,
  },
  support: {
    email: 'soporte.parkingsaas@gmail.com',
    whatsapp: '',
    schedule: 'Lun–Vie 8:00–18:00 (COT)',
  },
  defaults: {
    timezone: 'America/Bogota',
    language: 'es',
    currency: 'COP',
  },
  /** Prep. escalabilidad */
  i18n: { enabled: false, locales: ['es'] },
  multiCurrency: { enabled: false },
  multiSite: { enabled: false },
  dynamicVariables: { enabled: false },
});

/** Mapeo sección de settings → feature del plan (si aplica). */
export const SECTION_FEATURE_FLAGS = Object.freeze({
  general: 'settings',
  operational: 'settings',
  vehicle_categories: 'vehicles',
  rates: 'settings',
  payment_methods: 'payments',
  cash: 'cash',
  printing: 'printing',
  memberships: 'memberships',
  users: 'settings',
  integrations: 'integrations',
  backups: 'settings',
});

export const PLATFORM_AUDIT_ACTIONS = Object.freeze({
  UPDATED: 'platform_settings_updated',
});
