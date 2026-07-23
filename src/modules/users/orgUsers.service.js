import User from '#modules/user/user.model.js';
import OrganizationRole from '#modules/organizationRole/organizationRole.model.js';
import { passwordService } from '#modules/auth/password.service.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { rbacService } from '#services/rbac/rbac.service.js';
import { planLimitsService } from '#services/saas-billing/planLimits.service.js';

export const USER_AUDIT_ACTIONS = Object.freeze({
  CREATED: 'user_created',
  UPDATED: 'user_updated',
  ROLE_CHANGED: 'user_role_changed',
  ACTIVATED: 'user_activated',
  DEACTIVATED: 'user_deactivated',
  PASSWORD_RESET_REQUESTED: 'user_password_reset_requested',
});

export class OrgUsersService {
  async list(organizationId) {
    await rbacService.ensureDefaultRoles(organizationId);

    const users = await User.find({ organizationId })
      .populate('organizationRoleId', 'key name isActive')
      .sort({ createdAt: 1 })
      .lean();

    return users.map((u) => this.#toResponse(u));
  }

  async getById(organizationId, userId) {
    const user = await User.findOne({ _id: userId, organizationId })
      .populate('organizationRoleId', 'key name permissions isActive')
      .lean();

    if (!user) throw new ApiError(404, 'Usuario no encontrado');
    return this.#toResponse(user);
  }

  async create(organizationId, actorUserId, payload, auditContext = {}) {
    await planLimitsService.assertCanAddUser(organizationId);

    const email = payload.email.trim().toLowerCase();
    const existing = await User.findOne({ email }).select('_id');
    if (existing) throw new ApiError(409, 'Ya existe un usuario con ese correo');

    const role = await this.#assertOrgRole(organizationId, payload.organizationRoleId);
    const password = payload.password || this.#generateTempPassword();
    const hashed = await passwordService.hash(password);

    const user = await User.create({
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      email,
      phone: payload.phone?.trim() || null,
      password: hashed,
      organizationId,
      organizationRoleId: role._id,
      roleId: null,
      status: payload.status === 'inactive' ? 'inactive' : 'active',
      emailVerified: true,
      passwordResetRequired: !payload.password,
    });

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: 'users',
      action: USER_AUDIT_ACTIONS.CREATED,
      description: `Usuario creado: ${email}`,
      resourceId: user._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { organizationRoleId: role._id, roleKey: role.key },
    });

    return {
      user: await this.getById(organizationId, user._id),
      temporaryPassword: payload.password ? undefined : password,
    };
  }

  async update(organizationId, actorUserId, userId, payload, auditContext = {}) {
    const user = await User.findOne({ _id: userId, organizationId });
    if (!user) throw new ApiError(404, 'Usuario no encontrado');

    const previousRoleId = user.organizationRoleId?.toString();
    const previousStatus = user.status;

    if (payload.firstName != null) user.firstName = payload.firstName.trim();
    if (payload.lastName != null) user.lastName = payload.lastName.trim();
    if (payload.phone !== undefined) user.phone = payload.phone?.trim() || null;

    if (payload.organizationRoleId) {
      const role = await this.#assertOrgRole(organizationId, payload.organizationRoleId);
      user.organizationRoleId = role._id;
    }

    if (payload.status && ['active', 'inactive'].includes(payload.status)) {
      user.status = payload.status;
    }

    await user.save();

    const roleChanged =
      payload.organizationRoleId &&
      previousRoleId !== String(payload.organizationRoleId);

    if (roleChanged) {
      await auditService.log({
        userId: actorUserId,
        organizationId,
        module: 'users',
        action: USER_AUDIT_ACTIONS.ROLE_CHANGED,
        description: 'Cambio de rol de usuario',
        resourceId: user._id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
          from: previousRoleId,
          to: String(payload.organizationRoleId),
        },
      });
    }

    if (payload.status && payload.status !== previousStatus) {
      await auditService.log({
        userId: actorUserId,
        organizationId,
        module: 'users',
        action:
          payload.status === 'active'
            ? USER_AUDIT_ACTIONS.ACTIVATED
            : USER_AUDIT_ACTIONS.DEACTIVATED,
        description: `Usuario ${payload.status === 'active' ? 'activado' : 'desactivado'}`,
        resourceId: user._id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
      });
    }

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: 'users',
      action: USER_AUDIT_ACTIONS.UPDATED,
      description: 'Usuario actualizado',
      resourceId: user._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.getById(organizationId, userId);
  }

  /**
   * Arquitectura preparada para reset de contraseña (email/token en fase posterior).
   */
  async requestPasswordReset(organizationId, actorUserId, userId, auditContext = {}) {
    const user = await User.findOne({ _id: userId, organizationId });
    if (!user) throw new ApiError(404, 'Usuario no encontrado');

    const temporaryPassword = this.#generateTempPassword();
    user.password = await passwordService.hash(temporaryPassword);
    user.passwordResetRequired = true;
    await user.save();

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: 'users',
      action: USER_AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      description: 'Restablecimiento de contraseña solicitado',
      resourceId: user._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return { temporaryPassword, userId: user._id };
  }

  async #assertOrgRole(organizationId, roleId) {
    const role = await OrganizationRole.findOne({
      _id: roleId,
      organizationId,
      isActive: true,
    });
    if (!role) throw new ApiError(400, 'Rol de organización inválido o inactivo');
    return role;
  }

  #generateTempPassword() {
    return `Tmp-${Math.random().toString(36).slice(2, 10)}A1`;
  }

  #toResponse(user) {
    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? null,
      status: user.status,
      lastLoginAt: user.lastLoginAt ?? null,
      passwordResetRequired: user.passwordResetRequired ?? false,
      role: user.organizationRoleId
        ? {
            id: user.organizationRoleId._id ?? user.organizationRoleId,
            key: user.organizationRoleId.key,
            name: user.organizationRoleId.name,
            isActive: user.organizationRoleId.isActive,
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export const orgUsersService = new OrgUsersService();
