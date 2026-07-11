import OrganizationRole from '#modules/organizationRole/organizationRole.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { rbacService } from '#services/rbac/rbac.service.js';

export const ROLE_AUDIT_ACTIONS = Object.freeze({
  CREATED: 'role_created',
  UPDATED: 'role_updated',
  DUPLICATED: 'role_duplicated',
  ACTIVATED: 'role_activated',
  DEACTIVATED: 'role_deactivated',
  PERMISSIONS_CHANGED: 'role_permissions_changed',
});

export class OrgRolesService {
  async list(organizationId) {
    await rbacService.ensureDefaultRoles(organizationId);
    const roles = await OrganizationRole.find({ organizationId }).sort({ createdAt: 1 }).lean();

    return Promise.all(
      roles.map(async (role) => ({
        ...this.#toResponse(role),
        usersCount: await rbacService.countUsersWithRole(organizationId, role._id),
      })),
    );
  }

  async getById(organizationId, roleId) {
    const role = await OrganizationRole.findOne({ _id: roleId, organizationId }).lean();
    if (!role) throw new ApiError(404, 'Rol no encontrado');
    return {
      ...this.#toResponse(role),
      usersCount: await rbacService.countUsersWithRole(organizationId, role._id),
    };
  }

  async create(organizationId, actorUserId, payload, auditContext = {}) {
    await rbacService.ensureDefaultRoles(organizationId);
    const key = this.#slugify(payload.key || payload.name);

    const exists = await OrganizationRole.findOne({ organizationId, key });
    if (exists) throw new ApiError(409, `Ya existe un rol con la clave "${key}"`);

    const permissions = payload.permissions ?? [];
    rbacService.assertPermissionsValid(permissions);

    const role = await OrganizationRole.create({
      organizationId,
      key,
      name: payload.name.trim(),
      description: payload.description?.trim() ?? '',
      permissions,
      isSystem: false,
      isActive: payload.isActive !== false,
    });

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: 'roles',
      action: ROLE_AUDIT_ACTIONS.CREATED,
      description: `Rol creado: ${role.name}`,
      resourceId: role._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { permissions },
    });

    return this.getById(organizationId, role._id);
  }

  async update(organizationId, actorUserId, roleId, payload, auditContext = {}) {
    const role = await OrganizationRole.findOne({ _id: roleId, organizationId });
    if (!role) throw new ApiError(404, 'Rol no encontrado');

    const previousPermissions = [...(role.permissions ?? [])];
    const previousStatus = role.isActive;

    if (payload.name != null) role.name = payload.name.trim();
    if (payload.description !== undefined) role.description = payload.description?.trim() ?? '';

    if (Array.isArray(payload.permissions)) {
      rbacService.assertPermissionsValid(payload.permissions);
      role.permissions = payload.permissions;
    }

    if (typeof payload.isActive === 'boolean') {
      role.isActive = payload.isActive;
    }

    await role.save();

    if (
      Array.isArray(payload.permissions) &&
      JSON.stringify(previousPermissions.sort()) !==
        JSON.stringify([...(payload.permissions ?? [])].sort())
    ) {
      await auditService.log({
        userId: actorUserId,
        organizationId,
        module: 'roles',
        action: ROLE_AUDIT_ACTIONS.PERMISSIONS_CHANGED,
        description: `Permisos actualizados: ${role.name}`,
        resourceId: role._id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: { from: previousPermissions, to: payload.permissions },
      });
    }

    if (typeof payload.isActive === 'boolean' && payload.isActive !== previousStatus) {
      await auditService.log({
        userId: actorUserId,
        organizationId,
        module: 'roles',
        action: payload.isActive
          ? ROLE_AUDIT_ACTIONS.ACTIVATED
          : ROLE_AUDIT_ACTIONS.DEACTIVATED,
        description: `Rol ${payload.isActive ? 'activado' : 'desactivado'}: ${role.name}`,
        resourceId: role._id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
      });
    }

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: 'roles',
      action: ROLE_AUDIT_ACTIONS.UPDATED,
      description: `Rol actualizado: ${role.name}`,
      resourceId: role._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.getById(organizationId, roleId);
  }

  async duplicate(organizationId, actorUserId, roleId, auditContext = {}) {
    const source = await OrganizationRole.findOne({ _id: roleId, organizationId }).lean();
    if (!source) throw new ApiError(404, 'Rol no encontrado');

    let key = `${source.key}_copy`;
    let suffix = 1;
    while (await OrganizationRole.exists({ organizationId, key })) {
      suffix += 1;
      key = `${source.key}_copy_${suffix}`;
    }

    const role = await OrganizationRole.create({
      organizationId,
      key,
      name: `${source.name} (copia)`,
      description: source.description,
      permissions: [...(source.permissions ?? [])],
      isSystem: false,
      isActive: true,
    });

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: 'roles',
      action: ROLE_AUDIT_ACTIONS.DUPLICATED,
      description: `Rol duplicado desde ${source.name}`,
      resourceId: role._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { sourceRoleId: source._id },
    });

    return this.getById(organizationId, role._id);
  }

  async remove(organizationId, actorUserId, roleId, auditContext = {}) {
    const role = await OrganizationRole.findOne({ _id: roleId, organizationId });
    if (!role) throw new ApiError(404, 'Rol no encontrado');

    if (role.isSystem) {
      throw new ApiError(400, 'No se puede eliminar un rol del sistema. Desactívelo si es necesario.');
    }

    const usersCount = await rbacService.countUsersWithRole(organizationId, roleId);
    if (usersCount > 0) {
      throw new ApiError(
        409,
        `No se puede eliminar el rol: tiene ${usersCount} usuario(s) asociado(s)`,
      );
    }

    await role.deleteOne();

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: 'roles',
      action: 'role_deleted',
      description: `Rol eliminado: ${role.name}`,
      resourceId: roleId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return { deleted: true };
  }

  #slugify(value) {
    return String(value)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60);
  }

  #toResponse(role) {
    return {
      id: role._id,
      key: role.key,
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions ?? [],
      isActive: role.isActive,
      isSystem: role.isSystem,
      parentRoleId: role.parentRoleId ?? null,
      temporaryUntil: role.temporaryUntil ?? null,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}

export const orgRolesService = new OrgRolesService();
