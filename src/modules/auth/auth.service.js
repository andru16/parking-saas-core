import User from '#modules/user/user.model.js';
import Organization from '#modules/organization/organization.model.js';
import { passwordService } from '#modules/auth/password.service.js';
import { refreshTokenService } from '#modules/auth/refreshToken.service.js';
import { AUTH_AUDIT_ACTIONS, LOGIN_ELIGIBLE_USER_STATUSES } from '#modules/auth/constants.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { organizationAccessService } from '#services/organization/organizationAccess.service.js';

const PUBLIC_USER_FIELDS =
  'firstName lastName email phone status emailVerified organizationId roleId organizationRoleId avatar lastLoginAt passwordResetRequired';

/**
 * Servicio de autenticación — toda la lógica de negocio del módulo auth.
 */
export class AuthService {
  async login({ email, password }, context) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
      .select('+password')
      .populate('roleId', 'name displayName isPlatformRole')
      .populate('organizationRoleId', 'key name permissions isActive');

    if (!user) {
      await this.#auditLoginFailed({
        email: normalizedEmail,
        reason: 'user_not_found',
        context,
      });
      throw new ApiError(401, 'Credenciales inválidas');
    }

    const passwordValid = await passwordService.compare(password, user.password);

    if (!passwordValid) {
      await this.#auditLoginFailed({
        userId: user._id,
        organizationId: user.organizationId,
        email: normalizedEmail,
        reason: 'invalid_password',
        context,
      });
      throw new ApiError(401, 'Credenciales inválidas');
    }

    if (user.roleId?.isPlatformRole || user.roleId?.name === 'super_admin') {
      await this.#auditLoginFailed({
        userId: user._id,
        email: normalizedEmail,
        reason: 'platform_user_use_admin_login',
        context,
      });
      throw new ApiError(
        403,
        'Las cuentas de plataforma deben iniciar sesión en /admin/login',
      );
    }

    await this.#assertUserCanLogin(user, context);

    const { rbacService } = await import('#services/rbac/rbac.service.js');
    const access = await rbacService.resolveUserAccess(user);

    if (!access.roleKey) {
      await this.#auditLoginFailed({
        userId: user._id,
        organizationId: user.organizationId,
        email: normalizedEmail,
        reason: 'role_not_found',
        context,
      });
      throw new ApiError(403, 'El usuario no tiene un rol válido asignado');
    }

    const roleName = access.roleKey;

    try {
      if (!organizationAccessService.isPlatformUser(roleName)) {
        await organizationAccessService.assertLoginAccess(user.organizationId);
      }
    } catch (error) {
      await this.#auditLoginFailed({
        userId: user._id,
        organizationId: user.organizationId,
        email: normalizedEmail,
        reason: 'organization_access_denied',
        context,
      });
      throw error;
    }

    const lastLoginAt = new Date();
    const loginPatch = {
      lastLoginAt,
      lastLoginIp: context.ip ?? null,
      lastLoginUserAgent: context.userAgent ?? null,
    };

    // Persistencia parcial: evita revalidar el documento completo en login.
    if (access.organizationRoleId && !user.organizationRoleId) {
      loginPatch.organizationRoleId = access.organizationRoleId;
    }

    await User.updateOne({ _id: user._id }, { $set: loginPatch });
    user.lastLoginAt = lastLoginAt;
    user.lastLoginIp = loginPatch.lastLoginIp;
    user.lastLoginUserAgent = loginPatch.lastLoginUserAgent;
    if (loginPatch.organizationRoleId) {
      user.organizationRoleId = loginPatch.organizationRoleId;
    }

    const session = await refreshTokenService.createSession({
      user,
      roleName,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    await auditService.log({
      userId: user._id,
      organizationId: user.organizationId,
      module: 'auth',
      action: AUTH_AUDIT_ACTIONS.LOGIN_SUCCESS,
      description: 'Login correcto',
      ip: context.ip,
      userAgent: context.userAgent,
      resourceId: user._id,
      metadata: { role: roleName },
    });

    const safeUser = await this.#buildUserResponse(user._id);

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      refreshToken: session.refreshToken,
      user: safeUser,
    };
  }

  async logout(context) {
    const revoked = await refreshTokenService.revokeToken(context.refreshToken);

    if (context.userId) {
      await auditService.log({
        userId: context.userId,
        organizationId: context.organizationId,
        module: 'auth',
        action: AUTH_AUDIT_ACTIONS.LOGOUT,
        description: 'Logout',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { revoked },
      });
    }

    return { revoked };
  }

  async refresh(refreshToken, context) {
    if (!refreshToken) {
      throw new ApiError(401, 'Refresh token no proporcionado');
    }

    const session = await refreshTokenService.rotateSession({
      refreshToken,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    const roleName = session.roleName;

    if (!organizationAccessService.isPlatformUser(roleName) && session.user.organizationId) {
      await organizationAccessService.assertLoginAccess(session.user.organizationId);
    }

    // No se audita la renovación de sesión (ruido técnico; no aporta al cliente).

    const safeUser = await this.#buildUserResponse(session.user._id);

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      refreshToken: session.refreshToken,
      user: safeUser,
    };
  }

  async getAuthenticatedUser(userId) {
    return this.#buildUserResponse(userId);
  }

  async #assertUserCanLogin(user, context) {
    if (user.status === 'inactive') {
      await this.#auditLoginFailed({
        userId: user._id,
        organizationId: user.organizationId,
        email: user.email,
        reason: 'user_inactive',
        context,
      });
      throw new ApiError(403, 'La cuenta está desactivada');
    }

    if (!user.emailVerified || user.status === 'pending_verification') {
      await this.#auditLoginFailed({
        userId: user._id,
        organizationId: user.organizationId,
        email: user.email,
        reason: 'email_not_verified',
        context,
      });
      throw new ApiError(
        403,
        'Debe verificar su correo electrónico antes de iniciar sesión. Revise su bandeja de entrada o solicite un nuevo enlace.',
        [{ code: 'EMAIL_NOT_VERIFIED', email: user.email }],
      );
    }

    if (!LOGIN_ELIGIBLE_USER_STATUSES.includes(user.status)) {
      await this.#auditLoginFailed({
        userId: user._id,
        organizationId: user.organizationId,
        email: user.email,
        reason: 'user_status_blocked',
        context,
      });
      throw new ApiError(403, 'La cuenta no está habilitada para iniciar sesión');
    }

    if (user.mfaEnabled) {
      // Punto de extensión para MFA — no implementado en esta fase
      throw new ApiError(501, 'MFA requerido — funcionalidad pendiente');
    }
  }

  async #buildUserResponse(userId) {
    const user = await User.findById(userId)
      .select(PUBLIC_USER_FIELDS)
      .populate('roleId', 'name displayName isPlatformRole')
      .populate('organizationRoleId', 'key name permissions isActive')
      .lean();

    if (!user) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    const { rbacService } = await import('#services/rbac/rbac.service.js');
    const access = await rbacService.resolveUserAccess(user);

    let organization = null;

    if (user.organizationId) {
      organization = await Organization.findById(user.organizationId)
        .select('name status city country isSetupComplete setupProgress')
        .lean();
    }

    let subscription = null;
    if (user.organizationId) {
      const { subscriptionService } = await import(
        '#services/saas-billing/subscription.service.js'
      );
      subscription = await subscriptionService.getSummaryForOrganization(user.organizationId);
    }

    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? null,
      status: user.status,
      emailVerified: user.emailVerified,
      avatar: user.avatar,
      lastLoginAt: user.lastLoginAt,
      passwordResetRequired: user.passwordResetRequired ?? false,
      role: {
        key: access.roleKey,
        name: access.roleKey,
        displayName: access.roleDisplayName,
        isPlatformRole: access.isPlatformUser,
        id: access.organizationRoleId,
      },
      permissions: access.permissions,
      organization: organization
        ? {
            id: organization._id,
            name: organization.name,
            status: organization.status,
            city: organization.city,
            country: organization.country,
            isSetupComplete: organization.isSetupComplete,
            setupProgress: organization.setupProgress,
            subscription,
          }
        : null,
    };
  }

  async #auditLoginFailed({ userId = null, organizationId = null, email, reason, context }) {
    await auditService.log({
      userId,
      organizationId,
      module: 'auth',
      action: AUTH_AUDIT_ACTIONS.LOGIN_FAILED,
      description: 'Login fallido',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { email, reason },
    });
  }
}

export const authService = new AuthService();
