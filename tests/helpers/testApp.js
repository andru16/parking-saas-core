import mongoose from 'mongoose';
import request from 'supertest';
import { connectDatabase, disconnectDatabase } from '#database/connection.js';
import { ensurePlatformBootstrap } from '#modules/superAdmin/ensurePlatformBootstrap.js';
import { settingsRepository } from '#modules/systemSettings/settings.repository.js';
import app from '#app';
import VehicleCategory from '#modules/vehicleCategory/vehicleCategory.model.js';
import CashPoint from '#modules/cashPoint/cashPoint.model.js';
import Rate from '#modules/rate/rate.model.js';
import OrganizationRole from '#modules/organizationRole/organizationRole.model.js';
import ParkingMembership from '#modules/parkingMembership/parkingMembership.model.js';
import Member from '#modules/member/member.model.js';
import Vehicle from '#modules/vehicle/vehicle.model.js';

export const UA = 'ParkingSaaS-TestSuite/1.0';

export async function startTestDb() {
  if (mongoose.connection.readyState === 0) {
    await connectDatabase(process.env.MONGODB_URI);
  }
  await settingsRepository.ensurePlatformDefaults();
  await ensurePlatformBootstrap();
}

export async function stopTestDb() {
  await disconnectDatabase();
}

/** Limpia colecciones de negocio entre tests (mantiene roles/planes/SA). */
export async function resetBusinessData() {
  const keep = new Set(['roles', 'plans', 'planfeatures', 'platformsettings']);
  const collections = await mongoose.connection.db.collections();
  await Promise.all(
    collections
      .filter((c) => !keep.has(c.collectionName.toLowerCase()))
      .map((c) => c.deleteMany({})),
  );
  // Re-seed Super Admin user after wipe
  await ensurePlatformBootstrap();
}

export function api() {
  return request(app);
}

export async function registerOrganization(overrides = {}) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const body = {
    admin: {
      firstName: 'Admin',
      lastName: 'Test',
      email: `admin-${suffix}@test.local`,
      password: 'Password1!',
      confirmPassword: 'Password1!',
      ...(overrides.admin ?? {}),
    },
    organization: {
      name: `Org ${suffix}`,
      city: 'Bogotá',
      country: 'CO',
      phone: '3001234567',
      ...(overrides.organization ?? {}),
    },
  };

  const res = await api().post('/api/signup/register').set('User-Agent', UA).send(body);
  return { res, body, email: body.admin.email, password: body.admin.password };
}

export async function login(email, password) {
  const res = await api()
    .post('/api/auth/login')
    .set('User-Agent', UA)
    .send({ email, password });
  return res;
}

export async function loginAs(email, password) {
  const res = await login(email, password);
  if (res.status !== 200) {
    throw new Error(`Login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  const token = res.body?.data?.accessToken ?? res.body?.data?.tokens?.accessToken;
  if (!token) {
    throw new Error(`Sin accessToken: ${JSON.stringify(res.body)}`);
  }
  const cookies = res.headers['set-cookie'] ?? [];
  const user = res.body?.data?.user;
  if (user && !user.organizationId && user.organization?.id) {
    user.organizationId = user.organization.id;
  }
  return { token, cookies, body: res.body, user };
}

export async function loginSuperAdmin() {
  const res = await api()
    .post('/api/admin/auth/login')
    .set('User-Agent', UA)
    .send({
      email: process.env.SUPER_ADMIN_EMAIL,
      password: process.env.SUPER_ADMIN_PASSWORD,
    });
  if (res.status !== 200) {
    throw new Error(`SA login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  const token = res.body?.data?.accessToken ?? res.body?.data?.tokens?.accessToken;
  return { token, cookies: res.headers['set-cookie'] ?? [], body: res.body };
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}`, 'User-Agent': UA };
}

export async function seedOpsBasics(organizationId) {
  const category = await VehicleCategory.create({
    organizationId,
    name: 'Automóvil',
    color: '#3B82F6',
    isActive: true,
  });

  const cashPoint = await CashPoint.create({
    organizationId,
    name: 'Caja principal',
    status: 'active',
  });

  const rate = await Rate.create({
    organizationId,
    name: 'Tarifa auto',
    vehicleCategoryId: category._id,
    billingMode: 'fixed',
    value: 5000,
    contextType: 'normal',
    status: 'active',
  });

  return { category, cashPoint, rate };
}

export async function getOrgRoles(organizationId) {
  const roles = await OrganizationRole.find({ organizationId, isActive: true }).lean();
  const byKey = Object.fromEntries(roles.map((r) => [r.key, r]));
  return byKey;
}

export async function createMembership({
  organizationId,
  vehicleId,
  memberId,
  days = 30,
  amount = 100000,
}) {
  let mid = memberId;
  if (!mid) {
    const member = await Member.create({
      organizationId,
      name: 'Miembro Test',
      documentNumber: `DOC-${Date.now()}`,
      status: 'active',
    });
    mid = member._id;
    if (vehicleId) {
      await Vehicle.updateOne({ _id: vehicleId }, { $set: { memberId: mid } });
    }
  }

  const start = new Date();
  const end = new Date(Date.now() + days * 86400000);

  return ParkingMembership.create({
    organizationId,
    memberId: mid,
    vehicleId,
    name: 'Mensualidad test',
    startDate: start,
    endDate: end,
    status: 'active',
    amount,
  });
}

export function ticketIdOf(ticket) {
  return ticket?.id ?? ticket?._id;
}

export function vehicleIdOf(ticket) {
  const v = ticket?.vehicle ?? ticket?.vehicleId;
  if (v && typeof v === 'object') return v.id ?? v._id;
  return v;
}

export async function openCash(token, openingAmount = 0) {
  return api()
    .post('/api/cash-registers/open')
    .set(authHeader(token))
    .send({ openingAmount });
}
