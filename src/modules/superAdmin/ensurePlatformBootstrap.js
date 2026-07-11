import Role from '#modules/role/role.model.js';
import User from '#modules/user/user.model.js';
import { passwordService } from '#modules/auth/password.service.js';
import { ROLES } from '#modules/auth/constants.js';
import { seedRolesAndPlans } from '#database/seeds/rolesAndPlans.seed.js';
import env from '#config/env.js';
import { ALL_PLATFORM_PERMISSION_CODES } from './permissions.catalog.js';

/**
 * Asegura roles/planes globales y el usuario Super Admin de plataforma.
 */
export async function ensurePlatformBootstrap() {
  await seedRolesAndPlans();

  // Limpia índices legacy de organizationRoles antes de cualquier login de org
  const { rbacService } = await import('#services/rbac/rbac.service.js');
  await rbacService.dropLegacyOrganizationRoleIndexes();

  const role = await Role.findOneAndUpdate(
    { name: ROLES.SUPER_ADMIN },
    {
      $set: {
        displayName: 'Super Administrador',
        description: 'Administración global de la plataforma SaaS',
        permissions: ['*', ...ALL_PLATFORM_PERMISSION_CODES],
        isPlatformRole: true,
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );

  const email = env.superAdmin.email.trim().toLowerCase();
  const hashed = await passwordService.hash(env.superAdmin.password);
  const existing = await User.findOne({ email }).select('+password');

  if (existing) {
    existing.roleId = role._id;
    existing.organizationId = null;
    existing.organizationRoleId = null;
    existing.status = 'active';
    existing.emailVerified = true;
    // Sincroniza con SUPER_ADMIN_PASSWORD del .env en cada arranque.
    existing.password = hashed;
    await existing.save();
    return { role, user: existing, created: false };
  }

  const user = await User.create({
    firstName: env.superAdmin.firstName,
    lastName: env.superAdmin.lastName,
    email,
    password: hashed,
    roleId: role._id,
    organizationId: null,
    organizationRoleId: null,
    status: 'active',
    emailVerified: true,
  });

  return { role, user, created: true };
}
