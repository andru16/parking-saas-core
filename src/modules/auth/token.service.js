import jwt from 'jsonwebtoken';
import env from '#config/env.js';
import { ApiError } from '#utils/ApiError.js';
import { AUTH_COOKIE_NAMES, AUTH_TOKEN_TYPES } from './constants.js';

/**
 * Servicio de generación y validación de JWT (access + refresh).
 * Access token → cuerpo de respuesta / header Authorization.
 * Refresh token → cookie HttpOnly exclusivamente.
 */
export class TokenService {
  signAccessToken(payload) {
    return jwt.sign({ ...payload, type: AUTH_TOKEN_TYPES.ACCESS }, env.jwt.accessSecret, {
      expiresIn: env.jwt.accessExpiresIn,
    });
  }

  signRefreshToken(payload) {
    return jwt.sign({ ...payload, type: AUTH_TOKEN_TYPES.REFRESH }, env.jwt.refreshSecret, {
      expiresIn: env.jwt.refreshExpiresIn,
    });
  }

  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, env.jwt.accessSecret);

      if (decoded.type !== AUTH_TOKEN_TYPES.ACCESS) {
        throw new ApiError(401, 'Token de acceso inválido');
      }

      return decoded;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(401, 'Token de acceso inválido o expirado');
    }
  }

  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, env.jwt.refreshSecret);

      if (decoded.type !== AUTH_TOKEN_TYPES.REFRESH) {
        throw new ApiError(401, 'Refresh token inválido');
      }

      return decoded;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(401, 'Refresh token inválido o expirado');
    }
  }

  getCookieOptions() {
    return {
      httpOnly: env.cookies.httpOnly,
      secure: env.cookies.secure,
      sameSite: env.cookies.sameSite,
      path: env.cookies.path,
      domain: env.cookies.domain || undefined,
    };
  }

  setRefreshCookie(res, refreshToken) {
    res.cookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
      ...this.getCookieOptions(),
      maxAge: this.getRefreshExpiresMs(),
    });
  }

  clearRefreshCookie(res) {
    res.clearCookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN, {
      path: env.cookies.path,
      domain: env.cookies.domain || undefined,
    });
  }

  extractAccessToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }

  extractRefreshToken(req) {
    return req.cookies?.[AUTH_COOKIE_NAMES.REFRESH_TOKEN] ?? null;
  }

  getRefreshExpiresMs() {
    return this.#parseExpiresToMs(env.jwt.refreshExpiresIn);
  }

  #parseExpiresToMs(expiresIn) {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * multipliers[unit];
  }
}

export const tokenService = new TokenService();
