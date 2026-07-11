import crypto from 'node:crypto';
import RefreshToken from '#modules/auth/refreshToken.model.js';
import { tokenService } from '#modules/auth/token.service.js';
import { LOGIN_ELIGIBLE_USER_STATUSES } from '#modules/auth/constants.js';
import { hashToken } from '#services/verification/verificationToken.service.js';
import { ApiError } from '#utils/ApiError.js';
import env from '#config/env.js';

/**
 * Gestión de refresh tokens con rotación e invalidación por familia.
 * Soporta múltiples dispositivos (cada login genera una familia nueva).
 */
export class RefreshTokenService {
  /**
   * Crea una sesión de refresh token para un dispositivo.
   */
  async createSession({ user, roleName, ip, userAgent }) {
    const jti = crypto.randomUUID();
    const familyId = crypto.randomUUID();

    const refreshToken = tokenService.signRefreshToken({
      sub: user._id.toString(),
      jti,
      familyId,
      role: roleName,
      organizationId: user.organizationId?.toString() ?? null,
    });

    const expiresAt = new Date(Date.now() + tokenService.getRefreshExpiresMs());

    await RefreshToken.create({
      userId: user._id,
      organizationId: user.organizationId ?? null,
      jti,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      ip,
      userAgent,
    });

    const accessToken = tokenService.signAccessToken({
      sub: user._id.toString(),
      role: roleName,
      organizationId: user.organizationId?.toString() ?? null,
      email: user.email,
      jti,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.jwt.accessExpiresIn,
      jti,
      familyId,
    };
  }

  /**
   * Rota un refresh token: invalida el anterior y emite uno nuevo en la misma familia.
   */
  async rotateSession({ refreshToken, ip, userAgent }) {
    const payload = tokenService.verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const storedToken = await RefreshToken.findOne({ jti: payload.jti });

    if (!storedToken) {
      throw new ApiError(401, 'Sesión inválida');
    }

    if (storedToken.revokedAt) {
      await this.revokeFamily(storedToken.familyId);
      throw new ApiError(401, 'Sesión revocada. Inicia sesión nuevamente.');
    }

    if (storedToken.tokenHash !== tokenHash) {
      await this.revokeFamily(storedToken.familyId);
      throw new ApiError(401, 'Sesión inválida');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new ApiError(401, 'Sesión expirada');
    }

    const User = (await import('#modules/user/user.model.js')).default;
    const { rbacService } = await import('#services/rbac/rbac.service.js');
    const user = await User.findById(storedToken.userId)
      .populate('roleId', 'name displayName isPlatformRole')
      .populate('organizationRoleId', 'key name permissions isActive organizationId');

    if (!user || !LOGIN_ELIGIBLE_USER_STATUSES.includes(user.status)) {
      throw new ApiError(401, 'Usuario no autorizado');
    }

    const access = await rbacService.resolveUserAccess(user);
    const roleName = access.roleKey ?? user.roleId?.name ?? null;
    const organizationId = user.organizationId?.toString() ?? null;

    const newJti = crypto.randomUUID();

    const newRefreshToken = tokenService.signRefreshToken({
      sub: user._id.toString(),
      jti: newJti,
      familyId: storedToken.familyId,
      role: roleName,
      organizationId,
    });

    const expiresAt = new Date(Date.now() + tokenService.getRefreshExpiresMs());

    storedToken.revokedAt = new Date();
    storedToken.replacedByJti = newJti;
    await storedToken.save();

    await RefreshToken.create({
      userId: user._id,
      organizationId: user.organizationId ?? null,
      jti: newJti,
      familyId: storedToken.familyId,
      tokenHash: hashToken(newRefreshToken),
      expiresAt,
      ip,
      userAgent,
    });

    const accessToken = tokenService.signAccessToken({
      sub: user._id.toString(),
      role: roleName,
      organizationId,
      email: user.email,
      jti: newJti,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: env.jwt.accessExpiresIn,
      user,
      roleName,
    };
  }

  /**
   * Revoca un refresh token específico (logout).
   */
  async revokeToken(refreshToken) {
    if (!refreshToken) return false;

    try {
      const payload = tokenService.verifyRefreshToken(refreshToken);
      const tokenHash = hashToken(refreshToken);

      const storedToken = await RefreshToken.findOne({ jti: payload.jti, tokenHash });

      if (storedToken && !storedToken.revokedAt) {
        storedToken.revokedAt = new Date();
        await storedToken.save();
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  /**
   * Revoca todos los tokens de una familia (detección de reutilización).
   */
  async revokeFamily(familyId) {
    await RefreshToken.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
}

export const refreshTokenService = new RefreshTokenService();
