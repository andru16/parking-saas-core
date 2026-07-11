import {
  OrganizationBootstrapService,
  BOOTSTRAP_ORIGINS,
  createDefaultBootstrapSteps,
} from '#services/organization-bootstrap/index.js';

const SIGNUP_MESSAGE = 'Cuenta creada correctamente. Ya puede iniciar sesión con sus credenciales.';

/**
 * Servicio de registro (Self Signup).
 * Único punto de entrada para el alta pública de organizaciones.
 */
export class SignupService {
  constructor(bootstrapFactory = createSignupBootstrapService) {
    this.bootstrapFactory = bootstrapFactory;
  }

  /**
   * Registra una nueva organización con período de prueba automático.
   *
   * @param {object} params
   * @param {object} params.admin
   * @param {object} params.organization
   * @param {object} [params.metadata] - Extensible: campañas, invitaciones, códigos promo
   * @param {object} [params.auditContext]
   */
  async register({ admin, organization, metadata = {}, auditContext = {} }) {
    const bootstrapService = this.bootstrapFactory();

    const result = await bootstrapService.execute({
      organization: {
        name: organization.name,
        city: organization.city,
        country: organization.country,
        phone: organization.phone,
        email: admin.email,
      },
      admin: {
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        password: admin.password,
      },
      origin: BOOTSTRAP_ORIGINS.SELF_SIGNUP,
      organizationStatus: 'trial',
      userStatus: 'active',
      auditContext: {
        ...auditContext,
        metadata: {
          channel: metadata.channel ?? 'SELF_SIGNUP',
          referralCode: metadata.referralCode ?? null,
          promoCode: metadata.promoCode ?? null,
          invitationId: metadata.invitationId ?? null,
        },
      },
    });

    return {
      message: SIGNUP_MESSAGE,
      organization: {
        id: result.organization._id,
        name: result.organization.name,
        status: result.organization.status,
      },
      admin: {
        id: result.adminUser._id,
        email: result.adminUser.email,
        status: result.adminUser.status,
      },
      subscription: {
        id: result.subscription._id,
        planCode: result.plan.code,
        endDate: result.subscription.endDate,
      },
    };
  }
}

export function createSignupBootstrapService() {
  return new OrganizationBootstrapService(createDefaultBootstrapSteps());
}

export const signupService = new SignupService();
