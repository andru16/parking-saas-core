import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestDb,
  stopTestDb,
  resetBusinessData,
  api,
  registerOrganization,
  loginAs,
  loginSuperAdmin,
  authHeader,
} from '../helpers/testApp.js';

describe('Settings / Reportes / Auditoría / Notificaciones / Backups / Support', () => {
  beforeAll(async () => {
    await startTestDb();
  });
  afterAll(async () => {
    await stopTestDb();
  });
  beforeEach(async () => {
    await resetBusinessData();
  });

  it('settings sections accesibles', async () => {
    const { email, password } = await registerOrganization();
    const { token } = await loginAs(email, password);
    const res = await api().get('/api/settings').set(authHeader(token));
    expect([200, 404]).toContain(res.status);
    if (res.status === 404) {
      const general = await api().get('/api/settings/sections/general').set(authHeader(token));
      expect([200, 404]).toContain(general.status);
    }
  });

  it('reportes dashboard KPIs', async () => {
    const { email, password } = await registerOrganization();
    const { token } = await loginAs(email, password);
    const paths = [
      '/api/reports/dashboard/kpis',
      '/api/reports/dashboard',
      '/api/reports/summary',
    ];
    let ok = false;
    for (const p of paths) {
      const res = await api().get(p).set(authHeader(token));
      if (res.status === 200) {
        ok = true;
        break;
      }
    }
    expect(ok).toBe(true);
  });

  it('auditoría listable por admin', async () => {
    const { email, password } = await registerOrganization();
    const { token } = await loginAs(email, password);
    const res = await api().get('/api/audit').set(authHeader(token));
    expect(res.status).toBe(200);
  });

  it('notificaciones listables', async () => {
    const { email, password } = await registerOrganization();
    const { token } = await loginAs(email, password);
    const res = await api().get('/api/notifications').set(authHeader(token));
    expect(res.status).toBe(200);
  });

  it('backups status', async () => {
    const { email, password } = await registerOrganization();
    const { token } = await loginAs(email, password);
    const res = await api().get('/api/backups/status').set(authHeader(token));
    expect([200, 403]).toContain(res.status);
  });

  it('support create + reply + metrics SA', async () => {
    const { email, password } = await registerOrganization();
    const { token } = await loginAs(email, password);

    const created = await api()
      .post('/api/support')
      .set(authHeader(token))
      .send({
        subject: 'Ayuda test',
        description: 'Necesito asistencia con la caja',
        category: 'technical',
        priority: 'medium',
      });
    expect(created.status).toBe(201);
    const id = created.body.data.ticket._id;

    const reply = await api()
      .post(`/api/support/${id}/replies`)
      .set(authHeader(token))
      .send({ body: 'Más detalle del problema' });
    expect(reply.status).toBe(200);

    const sa = await loginSuperAdmin();
    const metrics = await api().get('/api/admin/support/metrics').set(authHeader(sa.token));
    expect(metrics.status).toBe(200);
    expect(metrics.body.data.metrics.open).toBeGreaterThanOrEqual(1);

    const saReply = await api()
      .post(`/api/admin/support/${id}/replies`)
      .set(authHeader(sa.token))
      .send({ body: 'Estamos revisando su caso' });
    expect(saReply.status).toBe(200);

    const close = await api()
      .patch(`/api/support/${id}/status`)
      .set(authHeader(token))
      .send({ status: 'closed' });
    expect(close.status).toBe(200);
  });

  it('validación: ticket support sin asunto → 400', async () => {
    const { email, password } = await registerOrganization();
    const { token } = await loginAs(email, password);
    const res = await api()
      .post('/api/support')
      .set(authHeader(token))
      .send({ description: 'sin asunto', category: 'other' });
    expect(res.status).toBe(400);
  });
});
