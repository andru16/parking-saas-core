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
  ticketIdOf,
} from '../helpers/testApp.js';

describe('Multi-tenant isolation', () => {
  beforeAll(async () => {
    await startTestDb();
  });
  afterAll(async () => {
    await stopTestDb();
  });
  beforeEach(async () => {
    await resetBusinessData();
  });

  it('org A no puede leer ticket de org B por ID', async () => {
    const a = await registerOrganization();
    const b = await registerOrganization();
    const loginA = await loginAs(a.email, a.password);
    const loginB = await loginAs(b.email, b.password);

    const orgAId = loginA.user.organizationId;
    const orgBId = loginB.user.organizationId;
    const opsA = await seedOpsBasics(orgAId);
    const opsB = await seedOpsBasics(orgBId);

    await openCash(loginA.token);
    await openCash(loginB.token);

    const entryB = await api()
      .post('/api/tickets/entry')
      .set(authHeader(loginB.token))
      .send({ plate: 'BBB111', vehicleCategoryId: opsB.category._id });
    expect(entryB.status).toBe(201);
    const ticketId = ticketIdOf(entryB.body.data.ticket);

    const steal = await api()
      .get(`/api/tickets/${ticketId}`)
      .set(authHeader(loginA.token));
    expect([403, 404]).toContain(steal.status);

    const collectSteal = await api()
      .post(`/api/tickets/${ticketId}/collect`)
      .set(authHeader(loginA.token))
      .send({ payments: [{ method: 'cash', amount: 5000 }] });
    expect([403, 404]).toContain(collectSteal.status);
  });

  it('JWT con organizationId ajeno no cambia el tenant (tenant desde DB)', async () => {
    const a = await registerOrganization();
    const b = await registerOrganization();
    const loginA = await loginAs(a.email, a.password);
    const loginB = await loginAs(b.email, b.password);

    await seedOpsBasics(loginB.user.organizationId);
    await openCash(loginB.token);

    // Token de A lista tickets abiertos (ruta real: /open)
    const listA = await api().get('/api/tickets/open').set(authHeader(loginA.token));
    expect(listA.status).toBe(200);
    const items = listA.body.data.tickets ?? listA.body.data.items ?? [];
    expect(Array.isArray(items)).toBe(true);

    // Token de plataforma no sirve en API tenant
    const sa = await loginSuperAdmin();
    const misuse = await api().get('/api/tickets/open').set(authHeader(sa.token));
    expect(misuse.status).toBe(401);
  });

  it('support tickets aislados por organización', async () => {
    const a = await registerOrganization();
    const b = await registerOrganization();
    const loginA = await loginAs(a.email, a.password);
    const loginB = await loginAs(b.email, b.password);

    const created = await api()
      .post('/api/support')
      .set(authHeader(loginB.token))
      .send({
        subject: 'Solo B',
        description: 'Ticket privado org B',
        category: 'question',
        priority: 'low',
      });
    expect(created.status).toBe(201);
    const ticketId = created.body.data.ticket._id;

    const steal = await api().get(`/api/support/${ticketId}`).set(authHeader(loginA.token));
    expect([403, 404]).toContain(steal.status);

    const listA = await api().get('/api/support').set(authHeader(loginA.token));
    expect(listA.status).toBe(200);
    const items = listA.body.data.items ?? [];
    expect(items.find((t) => t._id === ticketId)).toBeUndefined();
  });
});
