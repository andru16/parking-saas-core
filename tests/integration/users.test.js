import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestDb,
  stopTestDb,
  resetBusinessData,
  api,
  registerOrganization,
  loginAs,
  authHeader,
  getOrgRoles,
} from '../helpers/testApp.js';

describe('Users / Roles / Permisos', () => {
  beforeAll(async () => {
    await startTestDb();
  });
  afterAll(async () => {
    await stopTestDb();
  });
  beforeEach(async () => {
    await resetBusinessData();
  });

  it('admin puede listar y crear usuarios', async () => {
    const { email, password, res: signup } = await registerOrganization();
    const orgId =
      signup.body?.data?.organization?.id ??
      signup.body?.data?.organization?._id ??
      signup.body?.data?.organizationId;
    const { token, user } = await loginAs(email, password);
    const organizationId = orgId ?? user?.organizationId;
    const roles = await getOrgRoles(organizationId);
    const cashierRole = roles.cashier;

    const create = await api()
      .post('/api/users')
      .set(authHeader(token))
      .send({
        firstName: 'Cajero',
        lastName: 'Uno',
        email: `cashier-${Date.now()}@test.local`,
        organizationRoleId: cashierRole._id,
        password: 'Cashier1!',
        status: 'active',
      });
    expect(create.status).toBe(201);
    const userId = create.body.data.user._id ?? create.body.data.user.id;

    const list = await api().get('/api/users').set(authHeader(token));
    expect(list.status).toBe(200);
    expect(list.body.data.users?.length).toBeGreaterThanOrEqual(2);

    const update = await api()
      .put(`/api/users/${userId}`)
      .set(authHeader(token))
      .send({ status: 'inactive' });
    expect(update.status).toBe(200);
    expect(update.body.data.user.status).toBe('inactive');
  });

  it('admin puede listar roles y catálogo de permisos', async () => {
    const { email, password } = await registerOrganization();
    const { token } = await loginAs(email, password);

    const roles = await api().get('/api/users/roles').set(authHeader(token));
    expect(roles.status).toBe(200);

    const catalog = await api().get('/api/users/permissions/catalog').set(authHeader(token));
    expect(catalog.status).toBe(200);
  });

  it('cajero no puede gestionar usuarios (403)', async () => {
    const { email, password, res: signup } = await registerOrganization();
    const { token: adminToken, user } = await loginAs(email, password);
    const organizationId =
      signup.body?.data?.organization?.id ??
      signup.body?.data?.organization?._id ??
      user?.organizationId;
    const roles = await getOrgRoles(organizationId);

    const cashierEmail = `cajero-${Date.now()}@test.local`;
    await api()
      .post('/api/users')
      .set(authHeader(adminToken))
      .send({
        firstName: 'Caj',
        lastName: 'Ero',
        email: cashierEmail,
        organizationRoleId: roles.cashier._id,
        password: 'Cashier1!',
      });

    const { token: cashierToken } = await loginAs(cashierEmail, 'Cashier1!');
    const res = await api().get('/api/users').set(authHeader(cashierToken));
    expect(res.status).toBe(403);
  });
});
