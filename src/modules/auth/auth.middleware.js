import { catchAsync } from '#utils/catchAsync.js';
import { ApiError } from '#utils/ApiError.js';
import User from '#modules/user/user.model.js';
import { organizationAccessService } from '#services/organization/organizationAccess.service.js';
import { rbacService } from '#services/rbac/rbac.service.js';
import { tokenService } from './token.service.js';
import { assertRequestMetadata } from './auth.helpers.js';
import { LOGIN_ELIGIBLE_USER_STATUSES, ROLES } from './constants.js';
import { PLATFORM_AUTH_AUDIENCE } from '#modules/superAdmin/permissions.catalog.js';

export const requireRequestMetadata = (req, _res, next) => {
  const result = assertRequestMetadata(req);

  if (!result.valid) {
    return next(new ApiError(400, result.message));
  }

  return next();
};

/**
 * Autenticación + carga de permisos RBAC en req.auth.
 * Rechaza tokens del backoffice de plataforma (aud=platform).
 */
export const authenticate = catchAsync(async (req, _res, next) => {
  const token = tokenService.extractAccessToken(req);

  if (!token) {
    throw new ApiError(401, 'No autenticado');
  }

  const payload = tokenService.verifyAccessToken(token);

  if (payload.aud === PLATFORM_AUTH_AUDIENCE) {
    throw new ApiError(401, 'Token de plataforma no válido en la app del cliente');
  }

  const user = await User.findById(payload.sub)
    .select('status organizationId email roleId organizationRoleId')
    .populate('roleId', 'name displayName isPlatformRole')
    .populate('organizationRoleId', 'key name permissions isActive')
    .lean();

  if (!user || !LOGIN_ELIGIBLE_USER_STATUSES.includes(user.status)) {
    throw new ApiError(401, 'Sesión inválida');
  }

  const access = await rbacService.resolveUserAccess(user);

  // Tenant siempre desde DB (nunca confiar solo en el claim JWT).
  req.auth = {
    userId: payload.sub,
    role: access.roleKey ?? payload.role ?? null,
    organizationId: user.organizationId?.toString() ?? null,
    email: user.email ?? payload.email ?? null,
    permissions: access.permissions,
    organizationRoleId: access.organizationRoleId,
    isPlatformUser: access.isPlatformUser,
  };

  next();
});

/**
 * Autorización por nombre de rol (legacy / plataforma).
 * Preferir requirePermission para rutas de organización.
 */
export const authorize = (...allowedRoles) =>
  catchAsync(async (req, _res, next) => {
    if (!req.auth) {
      throw new ApiError(401, 'No autenticado');
    }

    if (req.auth.isPlatformUser && allowedRoles.includes(ROLES.SUPER_ADMIN)) {
      return next();
    }

    // Mapear keys nuevas a nombres legacy en listas de authorize
    const roleAliases = {
      admin: ROLES.ORGANIZATION_ADMIN,
      supervisor: ROLES.SUPERVISOR,
      cashier: ROLES.CASHIER,
      [ROLES.ORGANIZATION_ADMIN]: 'admin',
      [ROLES.SUPERVISOR]: 'supervisor',
      [ROLES.CASHIER]: 'cashier',
    };

    const current = req.auth.role;
    const allowed = allowedRoles.some(
      (r) => r === current || roleAliases[r] === current || roleAliases[current] === r,
    );

    if (!allowed) {
      throw new ApiError(403, 'No tienes permisos para realizar esta acción');
    }

    next();
  });

/**
 * Requiere al menos uno de los permisos indicados.
 * Super Admin (`*`) siempre pasa.
 */
export const requirePermission = (...permissionCodes) =>
  catchAsync(async (req, _res, next) => {
    if (!req.auth) {
      throw new ApiError(401, 'No autenticado');
    }

    if (!rbacService.hasPermission(req.auth.permissions, permissionCodes)) {
      throw new ApiError(403, 'No tienes permisos para realizar esta acción');
    }

    next();
  });

/**
 * Requiere todos los permisos indicados.
 */
export const requireAllPermissions = (...permissionCodes) =>
  catchAsync(async (req, _res, next) => {
    if (!req.auth) {
      throw new ApiError(401, 'No autenticado');
    }

    if (!rbacService.hasAllPermissions(req.auth.permissions, permissionCodes)) {
      throw new ApiError(403, 'No tienes permisos para realizar esta acción');
    }

    next();
  });

export const requireActiveOrganization = catchAsync(async (req, _res, next) => {
  if (!req.auth) {
    throw new ApiError(401, 'No autenticado');
  }

  if (req.auth.isPlatformUser || organizationAccessService.isPlatformUser(req.auth.role)) {
    return next();
  }

  if (!req.auth.organizationId) {
    throw new ApiError(403, 'Contexto de organización requerido');
  }

  await organizationAccessService.assertOperationalAccess(req.auth.organizationId);
  next();
});

/** Consulta / exportación / renovación — permite organización suspendida. */
export const requireOrganizationReadAccess = catchAsync(async (req, _res, next) => {
  if (!req.auth) {
    throw new ApiError(401, 'No autenticado');
  }

  if (req.auth.isPlatformUser || organizationAccessService.isPlatformUser(req.auth.role)) {
    return next();
  }

  if (!req.auth.organizationId) {
    throw new ApiError(403, 'Contexto de organización requerido');
  }

  await organizationAccessService.assertReadAccess(req.auth.organizationId);
  next();
});

export const optionalAuthenticate = catchAsync(async (req, _res, next) => {
  const token = tokenService.extractAccessToken(req);

  if (!token) {
    return next();
  }

  try {
    const payload = tokenService.verifyAccessToken(token);

    req.auth = {
      userId: payload.sub,
      role: payload.role,
      organizationId: payload.organizationId ?? null,
      email: payload.email ?? null,
      permissions: [],
      isPlatformUser: payload.role === ROLES.SUPER_ADMIN,
    };
  } catch {
    // continuar sin auth
  }

  next();
});
