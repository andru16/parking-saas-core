/**
 * Permisos de plataforma (Super Admin).
 * Completamente separados del catálogo RBAC de Organizations.
 */
export const PLATFORM_PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'platform:dashboard:view',
  ORGS_VIEW: 'platform:organizations:view',
  ORGS_MANAGE: 'platform:organizations:manage',
  ORGS_SUSPEND: 'platform:organizations:suspend',
  ORGS_EXTEND_TRIAL: 'platform:organizations:extend_trial',
  ORGS_CHANGE_PLAN: 'platform:organizations:change_plan',
  PLANS_VIEW: 'platform:plans:view',
  PLANS_MANAGE: 'platform:plans:manage',
  USERS_VIEW: 'platform:users:view',
  AUDIT_VIEW: 'platform:audit:view',
  NOTIFICATIONS_VIEW: 'platform:notifications:view',
  IMPERSONATE: 'platform:impersonate',
  SUPPORT_MANAGE: 'platform:support:manage',
  ACTIVATIONS_MANAGE: 'platform:activations:manage',
  INCIDENTS_MANAGE: 'platform:incidents:manage',
  BACKUPS_VIEW: 'platform:backups:view',
  BACKUPS_MANAGE: 'platform:backups:manage',
  SETTINGS_MANAGE: 'platform:settings:manage',
});

export const ALL_PLATFORM_PERMISSION_CODES = Object.freeze(
  Object.values(PLATFORM_PERMISSIONS),
);

/** Audience JWT del backoffice de plataforma */
export const PLATFORM_AUTH_AUDIENCE = 'platform';

/** Audience JWT de la app del parqueadero */
export const TENANT_AUTH_AUDIENCE = 'tenant';

export const ADMIN_COOKIE_NAMES = Object.freeze({
  REFRESH_TOKEN: 'admin_refresh_token',
});

export const SUPER_ADMIN_AUDIT_MODULE = 'superAdmin';

export const SUPER_ADMIN_AUDIT_ACTIONS = Object.freeze({
  LOGIN_SUCCESS: 'sa_login_success',
  LOGIN_FAILED: 'sa_login_failed',
  LOGOUT: 'sa_logout',
  ORG_VIEWED: 'sa_org_viewed',
  ORG_ACTIVATED: 'sa_org_activated',
  ORG_SUSPENDED: 'sa_org_suspended',
  ORG_REACTIVATED: 'sa_org_reactivated',
  ORG_TRIAL_EXTENDED: 'sa_org_trial_extended',
  ORG_PLAN_CHANGED: 'sa_org_plan_changed',
  IMPERSONATION_REQUESTED: 'sa_impersonation_requested',
});
