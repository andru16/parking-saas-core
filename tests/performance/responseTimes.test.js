import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestDb,
  stopTestDb,
  api,
  registerOrganization,
  loginAs,
  authHeader,
  resetBusinessData,
} from '../helpers/testApp.js';

describe('Performance — tiempos de respuesta', () => {
  beforeAll(async () => {
    await startTestDb();
    await resetBusinessData();
  });
  afterAll(async () => {
    await stopTestDb();
  });

  it('login responde en < 3s', async () => {
    const { email, password } = await registerOrganization();
    const t0 = Date.now();
    const res = await loginAs(email, password);
    const ms = Date.now() - t0;
    expect(res.token).toBeTruthy();
    expect(ms).toBeLessThan(3000);
  });

  it('listado tickets abiertos < 2s', async () => {
    const { email, password } = await registerOrganization();
    const { token } = await loginAs(email, password);
    const t0 = Date.now();
    const res = await api().get('/api/tickets/open').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
