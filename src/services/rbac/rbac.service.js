import OrganizationRole from '#modules/organizationRole/organizationRole.model.js';
import User from '#modules/user/user.model.js';
import { ApiError } from '#utils/ApiError.js';
import { DEFAULT_ORG_ROLE_TEMPLATES } from './defaultOrgRoles.js';
import { isValidPermissionCode, PERMISSION_MODULES } from './permission.catalog.js';

let legacyIndexesDropped = false;

/**
 * Servicios RBAC multi-tenant.
 */
export class RbacService {
  getPermissionCatalog() {
    return PERMISSION_MODULES;
  }

  /**
   * Elimina índices del esquema antiguo (organizationId + roleId).
   * Ese índice único con roleId:null rompe el modelo actual (key + permissions).
   */
  async dropLegacyOrganizationRoleIndexes() {
    if (legacyIndexesDropped) return;
    try {
      const collection = OrganizationRole.collection;
      const indexes = await collection.indexes();
      for (const idx of indexes) {
        const name = idx.name;
        if (!name || name === '_id_') continue;
        // Índice legacy del join Role global
        if (name === 'organizationId_1_roleId_1' || name.includes('roleId')) {
          await collection.dropIndex(name);
        }
      }
    } catch (error) {
      // Índice inexistente u otra carrera — no bloquear login
      if (error?.code !== 27 && error?.codeName !== 'IndexNotFound') {
        console.warn('[rbac] No se pudo limpiar índices legacy de organizationRoles:', error.message);
      }
    } finally {
      legacyIndexesDropped = true;
    }
  }

  /**
   * Crea los 3 roles iniciales de una Organization (idempotente).
   * Si ya existen, sincroniza permisos de roles de sistema con la plantilla actual.
   */
  async ensureDefaultRoles(organizationId, session = null) {
    await this.dropLegacyOrganizationRoleIndexes();

    const existing = await OrganizationRole.find({ organizationId })
      .session(session)
      .lean();

    const hasNewSchema = existing.some((r) => r.key);

    if (!hasNewSchema) {
      if (existing.length > 0) {
        await OrganizationRole.deleteMany({ organizationId }).session(session);
      }

      for (const t of DEFAULT_ORG_ROLE_TEMPLATES) {
        await OrganizationRole.updateOne(
          { organizationId, key: t.key },
          {
            $set: {
              name: t.name,
              description: t.description,
              permissions: [...t.permissions],
              isSystem: t.isSystem,
              isActive: true,
            },
            $setOnInsert: {
              organizationId,
              key: t.key,
            },
          },
          { upsert: true, session },
        );
      }

      return OrganizationRole.find({ organizationId }).session(session);
    }

    // Sincronizar permisos de roles de sistema (p. ej. admin con catálogo ampliado)
    for (const template of DEFAULT_ORG_ROLE_TEMPLATES) {
      if (!template.isSystem) continue;
      const role = existing.find((r) => r.key === template.key);
      if (!role) {
        await OrganizationRole.updateOne(
          { organizationId, key: template.key },
          {
            $set: {
              name: template.name,
              description: template.description,
              permissions: [...template.permissions],
              isSystem: true,
              isActive: true,
            },
            $setOnInsert: {
              organizationId,
              key: template.key,
            },
          },
          { upsert: true, session },
        );
        continue;
      }

      const current = role.permissions ?? [];
      const missing = template.permissions.filter((p) => !current.includes(p));
      if (missing.length > 0) {
        await OrganizationRole.updateOne(
          { _id: role._id },
          { $addToSet: { permissions: { $each: missing } } },
        ).session(session);
      }
    }

    return OrganizationRole.find({ organizationId }).session(session);
  }

  async getAdminRole(organizationId, session = null) {
    const roles = await this.ensureDefaultRoles(organizationId, session);
    const admin = roles.find((r) => r.key === 'admin');
    if (!admin) {
      throw new ApiError(500, 'Rol Administrador no encontrado para la organización');
    }
    return admin;
  }

  async resolveUserAccess(user) {
    if (!user) {
      return { roleKey: null, roleDisplayName: null, permissions: [], isPlatformUser: false };
    }

    // Super admin / rol de plataforma
    if (user.roleId?.isPlatformRole || user.roleId?.name === 'super_admin') {
      return {
        roleKey: 'super_admin',
        roleDisplayName: user.roleId?.displayName ?? 'Super Admin',
        permissions: ['*'],
        isPlatformUser: true,
        organizationRoleId: null,
      };
    }

    let orgRole = user.organizationRoleId;
    const orgId = user.organizationId;

    const loadOrgRoleById = async (roleId) => {
      if (!orgId || !roleId) return null;
      return OrganizationRole.findOne({ _id: roleId, organizationId: orgId }).lean();
    };

    if (orgRole && orgRole._id && (!orgRole.permissions || !orgRole.key)) {
      orgRole = await loadOrgRoleById(orgRole._id);
    }
    // Si viene solo el ObjectId sin populate
    if (orgRole && !orgRole.permissions && !orgRole.key && orgRole.toString) {
      orgRole = await loadOrgRoleById(orgRole);
    }

    // Rol poblado pero de otra organización → rechazar
    if (
      orgRole?.organizationId &&
      orgId &&
      String(orgRole.organizationId) !== String(orgId)
    ) {
      orgRole = null;
    }

    if (orgId) {
      await this.ensureDefaultRoles(orgId);
    }

    if (!orgRole && orgId) {
      // Intentar mapear por roleId global legacy
      const legacyName = user.roleId?.name;
      const keyMap = {
        organization_admin: 'admin',
        supervisor: 'supervisor',
        cashier: 'cashier',
      };
      const key = keyMap[legacyName] ?? 'cashier';
      orgRole = await OrganizationRole.findOne({
        organizationId: orgId,
        key,
      }).lean();

      if (orgRole && user._id) {
        await User.updateOne({ _id: user._id }, { organizationRoleId: orgRole._id });
      }
    } else if (orgRole?._id && orgId) {
      // Recargar tras sync de permisos de sistema (scoped a la org)
      orgRole = await loadOrgRoleById(orgRole._id);
    }

    if (!orgRole || !orgRole.isActive) {
      return {
        roleKey: null,
        roleDisplayName: null,
        permissions: [],
        isPlatformUser: false,
        organizationRoleId: null,
      };
    }

    return {
      roleKey: orgRole.key,
      roleDisplayName: orgRole.name,
      permissions: orgRole.permissions ?? [],
      isPlatformUser: false,
      organizationRoleId: orgRole._id?.toString?.() ?? String(orgRole._id),
    };
  }

  hasPermission(permissions, required) {
    if (!permissions?.length) return false;
    if (permissions.includes('*')) return true;
    const needed = Array.isArray(required) ? required : [required];
    return needed.some((code) => permissions.includes(code));
  }

  hasAllPermissions(permissions, required) {
    if (!permissions?.length) return false;
    if (permissions.includes('*')) return true;
    return required.every((code) => permissions.includes(code));
  }

  assertPermissionsValid(codes) {
    for (const code of codes) {
      if (!isValidPermissionCode(code)) {
        throw new ApiError(400, `Permiso inválido: ${code}`);
      }
    }
  }

  async countUsersWithRole(organizationId, roleId) {
    return User.countDocuments({
      organizationId,
      organizationRoleId: roleId,
    });
  }
}

export const rbacService = new RbacService();
