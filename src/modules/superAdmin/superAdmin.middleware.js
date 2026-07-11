import { catchAsync } from '#utils/catchAsync.js';
import { ApiError } from '#utils/ApiError.js';
import User from '#modules/user/user.model.js';
import { tokenService } from '#modules/auth/token.service.js';
import { LOGIN_ELIGIBLE_USER_STATUSES, ROLES } from '#modules/auth/constants.js';
import {
  PLATFORM_AUTH_AUDIENCE,
  PLATFORM_PERMISSIONS,
} from './permissions.catalog.js';

/**
 * Autenticación + autorización exclusiva del backoffice de plataforma.
 */
export const authenticateSuperAdmin = catchAsync(async (req, _res, next) => {
  const token = tokenService.extractAccessToken(req);
  if (!token) throw new ApiError(401, 'No autenticado');

  const payload = tokenService.verifyAccessToken(token);

  if (payload.aud !== PLATFORM_AUTH_AUDIENCE) {
    throw new ApiError(401, 'Token de plataforma requerido. Use /admin/login');
  }

  if (payload.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(403, 'Acceso exclusivo del Super Administrador');
  }

  const user = await User.findById(payload.sub)
    .select('status email roleId')
    .populate('roleId', 'name isPlatformRole isActive')
    .lean();

  if (!user || !LOGIN_ELIGIBLE_USER_STATUSES.includes(user.status)) {
    throw new ApiError(401, 'Sesión inválida');
  }

  if (!user.roleId?.isPlatformRole || user.roleId.name !== ROLES.SUPER_ADMIN) {
    throw new ApiError(403, 'Acceso exclusivo del Super Administrador');
  }

  req.platformAuth = {
    userId: payload.sub,
    email: payload.email ?? user.email,
    role: ROLES.SUPER_ADMIN,
    permissions: ['*', ...Object.values(PLATFORM_PERMISSIONS)],
    realm: PLATFORM_AUTH_AUDIENCE,
  };

  // Compatibilidad mínima con middlewares que lean req.auth
  req.auth = {
    userId: req.platformAuth.userId,
    role: req.platformAuth.role,
    organizationId: null,
    email: req.platformAuth.email,
    permissions: req.platformAuth.permissions,
    isPlatformUser: true,
  };

  next();
});

/**
 * Requiere al menos uno de los permisos de plataforma.
 */
export const requirePlatformPermission = (...codes) =>
  catchAsync(async (req, _res, next) => {
    if (!req.platformAuth) throw new ApiError(401, 'No autenticado');

    const perms = req.platformAuth.permissions ?? [];
    if (perms.includes('*')) return next();

    const needed = codes.flat();
    const ok = needed.some((c) => perms.includes(c));
    if (!ok) throw new ApiError(403, 'No tienes permisos de plataforma para esta acción');

    next();
  });
