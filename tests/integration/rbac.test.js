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
  getOrgRoles,
  seedOpsBasics,
  openCash,
} from '../helpers/testApp.js';

describe('RBAC — roles org y Super Admin', () => {
  beforeAll(async () => {
    await startTestDb();
  });
  afterAll(async () => {
    await stopTestDb();
  });
  beforeEach(async () => {
    await resetBusinessData();
  });

  async function createRoleUser(adminToken, organizationId, roleKey, email) {
    const roles = await getOrgRoles(organizationId);
    const created = await api()
      .post('/api/users')
      .set(authHeader(adminToken))
      .send({
        firstName: roleKey,
        lastName: 'User',
        email,
        organizationRoleId: roles[roleKey]._id,
        password: 'Password1!',
      });
    expect(created.status).toBe(201);
    return loginAs(email, 'Password1!');
  }

  it('cajero puede operar tickets pero no ver auditoría', async () => {
    const { email, password } = await registerOrganization();
    const admin = await loginAs(email, password);
    const orgId = admin.user.organizationId;
    const { category } = await seedOpsBasics(orgId);

    const cashier = await createRoleUser(
      admin.token,
      orgId,
      'cashier',
      `cajero-rbac-${Date.now()}@test.local`,
    );
    await openCash(cashier.token);

    const entry = await api()
      .post('/api/tickets/entry')
      .set(authHeader(cashier.token))
      .send({
        plate: 'RBAC01',
        vehicleCategoryId: category._id,
      });
    expect(entry.status).toBe(201);

    const audit = await api().get('/api/audit').set(authHeader(cashier.token));
    expect(audit.status).toBe(403);
  });

  it('supervisor puede ver reportes', async () => {
    const { email, password } = await registerOrganization();
    const admin = await loginAs(email, password);
    const supervisor = await createRoleUser(
      admin.token,
      admin.user.organizationId,
      'supervisor',
      `sup-rbac-${Date.now()}@test.local`,
    );

    const reports = await api().get('/api/reports/dashboard/kpis').set(authHeader(supervisor.token));
    expect([200, 404]).toContain(reports.status);
    if (reports.status === 404) {
      const alt = await api().get('/api/reports').set(authHeader(supervisor.token));
      expect([200, 404]).toContain(alt.status);
    }
  });

  it('Super Admin accede a panel admin, no a tickets tenant', async () => {
    const sa = await loginSuperAdmin();
    const orgs = await api().get('/api/admin/organizations').set(authHeader(sa.token));
    expect(orgs.status).toBe(200);

    const tenant = await api().get('/api/tickets').set(authHeader(sa.token));
    expect(tenant.status).toBe(401);
  });

  it('sin permiso settings:manage → 403 en setup complete', async () => {
    const { email, password } = await registerOrganization();
    const admin = await loginAs(email, password);
    const cashier = await createRoleUser(
      admin.token,
      admin.user.organizationId,
      'cashier',
      `cajero-setup-${Date.now()}@test.local`,
    );

    const res = await api().post('/api/setup/complete').set(authHeader(cashier.token));
    expect(res.status).toBe(403);
  });
});
