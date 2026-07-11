import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { authService } from './auth.service.js';
import { tokenService } from './token.service.js';
import { getRequestContext } from './auth.helpers.js';

export const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body, getRequestContext(req));

  tokenService.setRefreshCookie(res, result.refreshToken);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Inicio de sesión exitoso',
    data: {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    },
  });
});

export const logout = catchAsync(async (req, res) => {
  await authService.logout({
    userId: req.auth?.userId ?? null,
    organizationId: req.auth?.organizationId ?? null,
    refreshToken: tokenService.extractRefreshToken(req),
    ...getRequestContext(req),
  });

  tokenService.clearRefreshCookie(res);

  sendSuccess(res, {
    message: 'Sesión cerrada correctamente',
    data: null,
  });
});

export const refresh = catchAsync(async (req, res) => {
  const result = await authService.refresh(
    tokenService.extractRefreshToken(req),
    getRequestContext(req),
  );

  tokenService.setRefreshCookie(res, result.refreshToken);

  sendSuccess(res, {
    message: 'Token renovado',
    data: {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    },
  });
});

export const me = catchAsync(async (req, res) => {
  const user = await authService.getAuthenticatedUser(req.auth.userId);

  sendSuccess(res, {
    data: { user },
  });
});
