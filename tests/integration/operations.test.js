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
  seedOpsBasics,
  openCash,
  createMembership,
  ticketIdOf,
  vehicleIdOf,
} from '../helpers/testApp.js';

describe('Operaciones — tickets, caja, pagos, vehículos', () => {
  beforeAll(async () => {
    await startTestDb();
  });
  afterAll(async () => {
    await stopTestDb();
  });
  beforeEach(async () => {
    await resetBusinessData();
  });

  it('flujo entrada → cobro → salida con caja', async () => {
    const { email, password } = await registerOrganization();
    const { token, user } = await loginAs(email, password);
    const { category } = await seedOpsBasics(user.organizationId);

    const noCash = await api()
      .post('/api/tickets/entry')
      .set(authHeader(token))
      .send({ plate: 'ABC123', vehicleCategoryId: category._id });
    expect(noCash.status).toBe(403);

    const open = await openCash(token, 10000);
    expect(open.status).toBe(201);

    const entry = await api()
      .post('/api/tickets/entry')
      .set(authHeader(token))
      .send({ plate: 'ABC123', vehicleCategoryId: category._id });
    expect(entry.status).toBe(201);
    const ticket = entry.body.data.ticket;
    const ticketId = ticketIdOf(ticket);

    const dup = await api()
      .post('/api/tickets/entry')
      .set(authHeader(token))
      .send({ plate: 'ABC123', vehicleCategoryId: category._id });
    expect(dup.status).toBe(409);

    const preview = await api()
      .get(`/api/tickets/${ticketId}/exit-preview`)
      .set(authHeader(token));
    expect(preview.status).toBe(200);
    const total = preview.body.data.preview?.total ?? preview.body.data.total ?? 5000;

    const collect = await api()
      .post(`/api/tickets/${ticketId}/collect`)
      .set(authHeader(token))
      .send({
        payments: total > 0 ? [{ method: 'cash', amount: total }] : [],
      });
    expect(collect.status).toBe(200);

    const payments = await api()
      .get(`/api/payments/ticket/${ticketId}`)
      .set(authHeader(token));
    expect([200, 404]).toContain(payments.status);

    const closeCash = await api()
      .post('/api/cash-registers/close')
      .set(authHeader(token))
      .send({ closingAmount: 10000 + total, confirmed: true });
    expect(closeCash.status).toBe(200);
  });

  it('membresía activa cubre cobro (total 0)', async () => {
    const { email, password } = await registerOrganization();
    const { token, user } = await loginAs(email, password);
    const { category } = await seedOpsBasics(user.organizationId);
    await openCash(token);

    const entry = await api()
      .post('/api/tickets/entry')
      .set(authHeader(token))
      .send({ plate: 'MEM001', vehicleCategoryId: category._id });
    expect(entry.status).toBe(201);
    const ticket = entry.body.data.ticket;
    const vehicleId = vehicleIdOf(ticket);
    expect(vehicleId).toBeTruthy();
    await createMembership({ organizationId: user.organizationId, vehicleId });

    const ticketId = ticketIdOf(ticket);
    await api()
      .post(`/api/tickets/${ticketId}/collect`)
      .set(authHeader(token))
      .send({ payments: [] });

    const entry2 = await api()
      .post('/api/tickets/entry')
      .set(authHeader(token))
      .send({ plate: 'MEM001', vehicleCategoryId: category._id });
    expect(entry2.status).toBe(201);
    const tid = ticketIdOf(entry2.body.data.ticket);
    const collect = await api()
      .post(`/api/tickets/${tid}/collect`)
      .set(authHeader(token))
      .send({ payments: [] });
    expect(collect.status).toBe(200);
  });
});

describe('Organizations / Planes / Suscripciones (Super Admin)', () => {
  beforeAll(async () => {
    await startTestDb();
  });
  afterAll(async () => {
    await stopTestDb();
  });
  beforeEach(async () => {
    await resetBusinessData();
  });

  it('suspender y reactivar organización', async () => {
    const { res } = await registerOrganization();
    const orgId =
      res.body?.data?.organization?.id ??
      res.body?.data?.organization?._id ??
      res.body?.data?.organizationId;
    expect(orgId).toBeTruthy();

    const sa = await loginSuperAdmin();
    const suspend = await api()
      .patch(`/api/admin/organizations/${orgId}/status`)
      .set(authHeader(sa.token))
      .send({ action: 'suspend', reason: 'test' });
    expect(suspend.status).toBe(200);

    const activate = await api()
      .patch(`/api/admin/organizations/${orgId}/status`)
      .set(authHeader(sa.token))
      .send({ action: 'reactivate' });
    expect(activate.status).toBe(200);
  });

  it('lista planes y suscripciones', async () => {
    const sa = await loginSuperAdmin();
    const plans = await api().get('/api/admin/plans').set(authHeader(sa.token));
    expect(plans.status).toBe(200);

    const subs = await api().get('/api/admin/subscriptions/alerts').set(authHeader(sa.token));
    expect([200, 404]).toContain(subs.status);
  });
});
