import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  startTestDb,
  stopTestDb,
  resetBusinessData,
  api,
  UA,
  registerOrganization,
  login,
  loginAs,
  authHeader,
} from '../helpers/testApp.js';
import { tokenService } from '#modules/auth/token.service.js';

describe('Auth — unit/integration', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await resetBusinessData();
  });

  it('login exitoso con credenciales válidas', async () => {
    const { email, password } = await registerOrganization();
    const res = await login(email, password);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']?.some((c) => c.includes('refresh_token'))).toBe(true);
  });

  it('login falla con password incorrecta', async () => {
    const { email } = await registerOrganization();
    const res = await login(email, 'WrongPass1!');
    expect(res.status).toBe(401);
  });

  it('login requiere User-Agent', async () => {
    const { email, password } = await registerOrganization();
    const res = await api().post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(400);
  });

  it('me requiere JWT válido', async () => {
    const { email, password } = await registerOrganization();
    const { token } = await loginAs(email, password);
    const res = await api().get('/api/auth/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email.toLowerCase());
  });

  it('JWT inválido → 401', async () => {
    const res = await api().get('/api/auth/me').set(authHeader('not.a.jwt'));
    expect(res.status).toBe(401);
  });

  it('JWT vencido → 401', async () => {
    const expired = jwt.sign(
      { sub: '000000000000000000000001', type: 'access', email: 'x@y.z' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: -10 },
    );
    const res = await api().get('/api/auth/me').set(authHeader(expired));
    expect(res.status).toBe(401);
  });

  it('refresh rota access token', async () => {
    const { email, password } = await registerOrganization();
    const { cookies } = await loginAs(email, password);
    const res = await api()
      .post('/api/auth/refresh')
      .set('User-Agent', UA)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('logout limpia sesión', async () => {
    const { email, password } = await registerOrganization();
    const { token, cookies } = await loginAs(email, password);
    const res = await api()
      .post('/api/auth/logout')
      .set(authHeader(token))
      .set('Cookie', cookies);
    expect(res.status).toBe(200);

    const refresh = await api()
      .post('/api/auth/refresh')
      .set('User-Agent', UA)
      .set('Cookie', cookies);
    expect(refresh.status).toBeGreaterThanOrEqual(400);
  });

  it('tokenService verifica tipo access', () => {
    const token = tokenService.signAccessToken({
      sub: '000000000000000000000001',
      email: 'a@b.c',
      role: 'admin',
    });
    const decoded = tokenService.verifyAccessToken(token);
    expect(decoded.type).toBe('access');
  });
});
