import { ROLES } from '#modules/auth/constants.js';

/**
 * Orígenes válidos para la creación de una organización.
 */
export const BOOTSTRAP_ORIGINS = Object.freeze({
  SELF_SIGNUP: 'SELF_SIGNUP',
  SUPER_ADMIN: 'SUPER_ADMIN',
  API: 'API',
});

export const BOOTSTRAP_ORIGIN_VALUES = Object.freeze(Object.values(BOOTSTRAP_ORIGINS));

/**
 * Código del plan Trial por defecto.
 */
export const DEFAULT_PLAN_CODE = 'trial';

/**
 * Nombre del rol administrador de organización.
 */
export const ORG_ADMIN_ROLE_NAME = ROLES.ORGANIZATION_ADMIN;

/**
 * Roles de organización habilitados al bootstrap (excluye super_admin).
 */
export const ORG_LEVEL_ROLE_NAMES = Object.freeze([
  ROLES.ORGANIZATION_ADMIN,
  ROLES.SUPERVISOR,
  ROLES.CASHIER,
]);
