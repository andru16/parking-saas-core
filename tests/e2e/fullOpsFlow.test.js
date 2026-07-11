import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestDb,
  stopTestDb,
  resetBusinessData,
  api,
  registerOrganization,
  loginAs,
  authHeader,
  seedOpsBasics,
  openCash,
  createMembership,
  getOrgRoles,
  ticketIdOf,
  vehicleIdOf,
} from '../helpers/testApp.js';
import ParkingMembership from '#modules/parkingMembership/parkingMembership.model.js';

/**
 * E2E API — flujo operativo completo sin browser.
 */
describe('E2E — flujo completo de operación', () => {
  beforeAll(async () => {
    await startTestDb();
  });
  afterAll(async () => {
    await stopTestDb();
  });
  beforeEach(async () => {
    await resetBusinessData();
  });

  it('org → setup ops → usuario → entrada/salida → caja → membresía → reportes → logout', async () => {
    const t0 = Date.now();

    const signup = await registerOrganization({
      organization: { name: `E2E Parking ${Date.now()}`, city: 'Medellín', country: 'CO' },
    });
    expect(signup.res.status).toBeLessThan(300);

    const admin = await loginAs(signup.email, signup.password);
    const orgId = admin.user.organizationId;
    const { category } = await seedOpsBasics(orgId);

    const roles = await getOrgRoles(orgId);
    const cashierEmail = `e2e-cajero-${Date.now()}@test.local`;
    const userRes = await api()
      .post('/api/users')
      .set(authHeader(admin.token))
      .send({
        firstName: 'Cajero',
        lastName: 'E2E',
        email: cashierEmail,
        organizationRoleId: roles.cashier._id,
        password: 'Cashier1!',
      });
    expect(userRes.status).toBe(201);

    const cashier = await loginAs(cashierEmail, 'Cashier1!');

    const cashOpen = await openCash(cashier.token, 50000);
    expect(cashOpen.status).toBe(201);

    const entry = await api()
      .post('/api/tickets/entry')
      .set(authHeader(cashier.token))
      .send({ plate: 'E2E999', vehicleCategoryId: category._id });
    expect(entry.status).toBe(201);
    const ticket = entry.body.data.ticket;
    const ticketId = ticketIdOf(ticket);
    const vehicleId = vehicleIdOf(ticket);
    expect(ticketId).toBeTruthy();
    expect(vehicleId).toBeTruthy();

    const preview = await api()
      .get(`/api/tickets/${ticketId}/exit-preview`)
      .set(authHeader(cashier.token));
    expect(preview.status).toBe(200);
    const total = preview.body.data.preview?.total ?? preview.body.data.total ?? 0;

    const collect = await api()
      .post(`/api/tickets/${ticketId}/collect`)
      .set(authHeader(cashier.token))
      .send({
        payments: total > 0 ? [{ method: 'cash', amount: total }] : [],
      });
    expect(collect.status).toBe(200);

    const close = await api()
      .post('/api/cash-registers/close')
      .set(authHeader(cashier.token))
      .send({ closingAmount: 50000 + Number(total), confirmed: true });
    expect(close.status).toBe(200);

    const membership = await createMembership({
      organizationId: orgId,
      vehicleId,
      days: 30,
    });
    expect(membership.status).toBe('active');

    const renewedEnd = new Date(Date.now() + 60 * 86400000);
    const renewed = await ParkingMembership.findByIdAndUpdate(
      membership._id,
      { $set: { endDate: renewedEnd, amount: 180000 } },
      { new: true },
    );
    expect(new Date(renewed.endDate).getTime()).toBeGreaterThan(Date.now() + 40 * 86400000);

    const reports = await api()
      .get('/api/reports/dashboard/kpis')
      .set(authHeader(admin.token));
    expect(reports.status).toBe(200);

    const logout = await api()
      .post('/api/auth/logout')
      .set(authHeader(cashier.token))
      .set('Cookie', cashier.cookies);
    expect(logout.status).toBe(200);

    expect(Date.now() - t0).toBeLessThan(60_000);
  });
});
