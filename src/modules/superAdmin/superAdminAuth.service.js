import crypto from 'node:crypto';
import User from '#modules/user/user.model.js';
import RefreshToken from '#modules/auth/refreshToken.model.js';
import { passwordService } from '#modules/auth/password.service.js';
import { tokenService } from '#modules/auth/token.service.js';
import { LOGIN_ELIGIBLE_USER_STATUSES, ROLES } from '#modules/auth/constants.js';
import { hashToken } from '#services/verification/verificationToken.service.js';
import { auditService } from '#services/audit/audit.service.js';
import { ApiError } from '#utils/ApiError.js';
import env from '#config/env.js';
import {
  ADMIN_COOKIE_NAMES,
  ALL_PLATFORM_PERMISSION_CODES,
  PLATFORM_AUTH_AUDIENCE,
  SUPER_ADMIN_AUDIT_ACTIONS,
  SUPER_ADMIN_AUDIT_MODULE,
} from './permissions.catalog.js';

/**
 * Autenticación independiente del backoffice Super Admin.
 * Tokens con aud=platform; cookie admin_refresh_token en /api/admin/auth.
 */
export class SuperAdminAuthService {
  getAdminCookieOptions() {
    return {
      httpOnly: env.cookies.httpOnly,
      secure: env.cookies.secure,
      sameSite: env.cookies.sameSite,
      path: env.adminCookies.path,
      domain: env.cookies.domain || undefined,
    };
  }

  setRefreshCookie(res, refreshToken) {
    res.cookie(ADMIN_COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
      ...this.getAdminCookieOptions(),
      maxAge: tokenService.getRefreshExpiresMs(),
    });
  }

  clearRefreshCookie(res) {
    res.clearCookie(ADMIN_COOKIE_NAMES.REFRESH_TOKEN, {
      path: env.adminCookies.path,
      domain: env.cookies.domain || undefined,
    });
  }

  extractRefreshToken(req) {
    return req.cookies?.[ADMIN_COOKIE_NAMES.REFRESH_TOKEN] ?? null;
  }

  async login({ email, password }, context) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
      .select('+password')
      .populate('roleId', 'name displayName isPlatformRole permissions isActive');

    if (!user) {
      await this.#auditFailed({ email: normalizedEmail, reason: 'user_not_found', context });
      throw new ApiError(401, 'Credenciales inválidas');
    }

    const valid = await passwordService.compare(password, user.password);
    if (!valid) {
      await this.#auditFailed({
        userId: user._id,
        email: normalizedEmail,
        reason: 'invalid_password',
        context,
      });
      throw new ApiError(401, 'Credenciales inválidas');
    }

    if (!LOGIN_ELIGIBLE_USER_STATUSES.includes(user.status)) {
      await this.#auditFailed({
        userId: user._id,
        email: normalizedEmail,
        reason: 'user_inactive',
        context,
      });
      throw new ApiError(403, 'Cuenta deshabilitada');
    }

    if (!user.roleId?.isPlatformRole || user.roleId.name !== ROLES.SUPER_ADMIN) {
      await this.#auditFailed({
        userId: user._id,
        email: normalizedEmail,
        reason: 'not_platform_admin',
        context,
      });
      throw new ApiError(403, 'Acceso exclusivo del Super Administrador de la plataforma');
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          lastLoginAt: new Date(),
          lastLoginIp: context.ip ?? null,
          lastLoginUserAgent: context.userAgent ?? null,
        },
      },
    );

    const session = await this.#createSession(user, context);

    await auditService.log({
      userId: user._id,
      organizationId: null,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUPER_ADMIN_AUDIT_ACTIONS.LOGIN_SUCCESS,
      description: 'Login Super Admin',
      ip: context.ip,
      userAgent: context.userAgent,
      resourceId: user._id,
    });

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      refreshToken: session.refreshToken,
      user: this.#toUserResponse(user),
    };
  }

  async logout({ userId, refreshToken, ...context }) {
    if (refreshToken) {
      try {
        const payload = tokenService.verifyRefreshToken(refreshToken);
        await RefreshToken.updateOne(
          { jti: payload.jti },
          { $set: { revokedAt: new Date() } },
        );
      } catch {
        // ignore invalid token on logout
      }
    }

    if (userId) {
      await auditService.log({
        userId,
        organizationId: null,
        module: SUPER_ADMIN_AUDIT_MODULE,
        action: SUPER_ADMIN_AUDIT_ACTIONS.LOGOUT,
        description: 'Logout Super Admin',
        ip: context.ip,
        userAgent: context.userAgent,
        resourceId: userId,
      });
    }
  }

  async refresh(refreshToken, context) {
    if (!refreshToken) throw new ApiError(401, 'Sesión no encontrada');

    const payload = tokenService.verifyRefreshToken(refreshToken);
    if (payload.aud !== PLATFORM_AUTH_AUDIENCE) {
      throw new ApiError(401, 'Sesión de plataforma inválida');
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await RefreshToken.findOne({ jti: payload.jti });

    if (!stored || stored.revokedAt || stored.tokenHash !== tokenHash) {
      if (stored?.familyId) {
        await RefreshToken.updateMany(
          { familyId: stored.familyId, revokedAt: null },
          { $set: { revokedAt: new Date() } },
        );
      }
      throw new ApiError(401, 'Sesión inválida');
    }

    if (stored.expiresAt < new Date()) {
      throw new ApiError(401, 'Sesión expirada');
    }

    const user = await User.findById(stored.userId).populate(
      'roleId',
      'name displayName isPlatformRole permissions isActive',
    );

    if (
      !user ||
      !LOGIN_ELIGIBLE_USER_STATUSES.includes(user.status) ||
      !user.roleId?.isPlatformRole
    ) {
      throw new ApiError(401, 'Usuario no autorizado');
    }

    stored.revokedAt = new Date();
    await stored.save();

    const session = await this.#createSession(user, context, stored.familyId);

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      refreshToken: session.refreshToken,
      user: this.#toUserResponse(user),
    };
  }

  async me(userId) {
    const user = await User.findById(userId).populate(
      'roleId',
      'name displayName isPlatformRole permissions isActive',
    );
    if (!user || !user.roleId?.isPlatformRole) {
      throw new ApiError(401, 'Sesión inválida');
    }
    return this.#toUserResponse(user);
  }

  async #createSession(user, context, familyId = crypto.randomUUID()) {
    const jti = crypto.randomUUID();
    const roleName = user.roleId.name;

    const refreshToken = tokenService.signRefreshToken({
      sub: user._id.toString(),
      jti,
      familyId,
      role: roleName,
      organizationId: null,
      aud: PLATFORM_AUTH_AUDIENCE,
    });

    const expiresAt = new Date(Date.now() + tokenService.getRefreshExpiresMs());

    await RefreshToken.create({
      userId: user._id,
      organizationId: null,
      jti,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    const accessToken = tokenService.signAccessToken({
      sub: user._id.toString(),
      role: roleName,
      organizationId: null,
      email: user.email,
      jti,
      aud: PLATFORM_AUTH_AUDIENCE,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.jwt.accessExpiresIn,
    };
  }

  #toUserResponse(user) {
    return {
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      lastLoginAt: user.lastLoginAt ?? null,
      role: {
        name: user.roleId?.name ?? ROLES.SUPER_ADMIN,
        displayName: user.roleId?.displayName ?? 'Super Administrador',
        isPlatformRole: true,
      },
      permissions: ['*', ...ALL_PLATFORM_PERMISSION_CODES],
      realm: PLATFORM_AUTH_AUDIENCE,
    };
  }

  async #auditFailed({ userId = null, email, reason, context }) {
    await auditService.log({
      userId,
      organizationId: null,
      module: SUPER_ADMIN_AUDIT_MODULE,
      action: SUPER_ADMIN_AUDIT_ACTIONS.LOGIN_FAILED,
      description: `Login Super Admin fallido: ${reason}`,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { email, reason },
    });
  }
}

export const superAdminAuthService = new SuperAdminAuthService();
