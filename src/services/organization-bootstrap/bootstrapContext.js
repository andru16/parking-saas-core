import { ApiError } from '#utils/ApiError.js';
import { BOOTSTRAP_ORIGIN_VALUES } from './constants.js';

/**
 * Contexto compartido entre todos los pasos del bootstrap.
 * Acumula entidades creadas y datos de entrada.
 */
export class BootstrapContext {
  constructor(input) {
    this.input = input;
    this.plan = null;
    this.organization = null;
    this.subscription = null;
    this.setting = null;
    this.organizationRoles = [];
    this.adminUser = null;
    this.adminRole = null;
  }

  static create(input) {
    BootstrapContext.validateInput(input);
    return new BootstrapContext(input);
  }

  static validateInput(input) {
    if (!input?.organization?.name?.trim()) {
      throw new ApiError(400, 'El nombre de la organización es obligatorio');
    }

    if (!input?.admin?.firstName?.trim()) {
      throw new ApiError(400, 'El nombre del administrador es obligatorio');
    }

    if (!input?.admin?.lastName?.trim()) {
      throw new ApiError(400, 'El apellido del administrador es obligatorio');
    }

    if (!input?.admin?.email?.trim()) {
      throw new ApiError(400, 'El correo del administrador es obligatorio');
    }

    if (!input?.admin?.password || input.admin.password.length < 8) {
      throw new ApiError(400, 'La contraseña del administrador debe tener al menos 8 caracteres');
    }

    if (!input?.origin || !BOOTSTRAP_ORIGIN_VALUES.includes(input.origin)) {
      throw new ApiError(400, 'El origen del bootstrap no es válido');
    }

    const requiresResponsibleUser = input.origin === 'SUPER_ADMIN' || input.origin === 'API';

    if (requiresResponsibleUser && !input.responsibleUserId) {
      throw new ApiError(400, 'El usuario responsable es obligatorio para este origen');
    }
  }

  /**
   * Usuario que aparece como responsable en la auditoría.
   */
  getAuditUserId() {
    if (this.input.origin === 'SELF_SIGNUP') {
      return this.adminUser._id;
    }

    return this.input.responsibleUserId;
  }

  toResult() {
    return {
      organization: this.organization,
      subscription: this.subscription,
      setting: this.setting,
      organizationRoles: this.organizationRoles,
      adminUser: this.toSafeAdminUser(),
      plan: this.plan,
      emailDelivery: this.emailDelivery
        ? {
            prepared: Boolean(this.emailDelivery.prepared),
            sent: Boolean(this.emailDelivery.sent),
            provider: this.emailDelivery.provider ?? null,
          }
        : null,
    };
  }

  toSafeAdminUser() {
    if (!this.adminUser) return null;

    const admin = this.adminUser.toObject ? this.adminUser.toObject() : { ...this.adminUser };
    delete admin.password;
    return admin;
  }
}
