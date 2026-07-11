import { describe, it, expect } from 'vitest';
import { ApiError } from '#utils/ApiError.js';
import { catchAsync } from '#utils/catchAsync.js';
import { tokenService } from '#modules/auth/token.service.js';
import { passwordService } from '#modules/auth/password.service.js';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from '#modules/support/constants.js';

describe('Unit — utils y auth helpers', () => {
  it('ApiError guarda status y es operacional', () => {
    const err = new ApiError(422, 'Validación', [{ field: 'email' }]);
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe('Validación');
    expect(err.isOperational).toBe(true);
    expect(err.errors).toHaveLength(1);
  });

  it('catchAsync propaga errores al next', async () => {
    const boom = new Error('fail');
    const mw = catchAsync(async () => {
      throw boom;
    });
    const next = (err) => {
      expect(err).toBe(boom);
    };
    await mw({}, {}, next);
  });

  it('passwordService hash y compare', async () => {
    const hash = await passwordService.hash('Secret1!');
    expect(hash).not.toBe('Secret1!');
    expect(await passwordService.compare('Secret1!', hash)).toBe(true);
    expect(await passwordService.compare('wrong', hash)).toBe(false);
  });

  it('tokenService sign/verify refresh distinto de access', () => {
    const access = tokenService.signAccessToken({ sub: '1', email: 'a@b.c' });
    const refresh = tokenService.signRefreshToken({ sub: '1', email: 'a@b.c' });
    expect(() => tokenService.verifyRefreshToken(access)).toThrow();
    expect(tokenService.verifyAccessToken(access).type).toBe('access');
    expect(tokenService.verifyRefreshToken(refresh).type).toBe('refresh');
  });
});

describe('Unit — support constants', () => {
  it('incluye categorías, prioridades y estados requeridos', () => {
    expect(Object.values(SUPPORT_CATEGORIES)).toContain('billing');
    expect(Object.values(SUPPORT_PRIORITIES)).toContain('critical');
    expect(Object.values(SUPPORT_STATUSES)).toContain('waiting_customer');
  });
});
