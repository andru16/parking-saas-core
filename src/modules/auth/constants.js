/**
 * Constantes del módulo de autenticación.
 */
export const AUTH_COOKIE_NAMES = Object.freeze({
  REFRESH_TOKEN: 'refresh_token',
});

export const AUTH_TOKEN_TYPES = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh',
});

/**
 * Roles del sistema.
 * Nomenclatura unificada para JWT, middleware y seeds.
 */
export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ORGANIZATION_ADMIN: 'organization_admin',
  SUPERVISOR: 'supervisor',
  CASHIER: 'cashier',
});

export const ORG_LEVEL_ROLES = Object.freeze([
  ROLES.ORGANIZATION_ADMIN,
  ROLES.SUPERVISOR,
  ROLES.CASHIER,
]);

export const AUTH_ROUTES = Object.freeze({
  LOGIN: '/login',
  LOGOUT: '/logout',
  REFRESH: '/refresh',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  ME: '/me',
});

export const AUTH_AUDIT_ACTIONS = Object.freeze({
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  REFRESH: 'refresh_token',
});

/** Estados de usuario que permiten sesión activa (requiere correo verificado + status active). */
export const LOGIN_ELIGIBLE_USER_STATUSES = Object.freeze(['active']);
