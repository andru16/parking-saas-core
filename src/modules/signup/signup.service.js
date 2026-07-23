import {
  OrganizationBootstrapService,
  BOOTSTRAP_ORIGINS,
  createDefaultBootstrapSteps,
  appendBootstrapStep,
} from '#services/organization-bootstrap/index.js';
import { CreateVerificationTokenStep } from './steps/createVerificationToken.step.js';
import env from '#config/env.js';
import { ApiError } from '#utils/ApiError.js';

const SIGNUP_MESSAGE =
  'Cuenta creada. Revisá tu correo y confirmá el enlace para activar el acceso.';

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
   * El admin queda pendiente de verificación de correo.
   */
  async register({
    admin,
    organization,
    consents,
    planCode,
    planId,
    metadata = {},
    auditContext = {},
  }) {
    if (consents?.privacyPolicyAccepted !== true) {
      throw new ApiError(
        400,
        'Debe aceptar la política de privacidad y tratamiento de datos para crear la cuenta',
      );
    }

    const bootstrapService = this.bootstrapFactory();

    const result = await bootstrapService.execute({
      planCode: planCode || undefined,
      planId: planId || undefined,
      organization: {
        name: organization.name,
        city: organization.city,
        stateOrDepartment: organization.stateOrDepartment,
        country: organization.country,
        phone: organization.phone,
        email: admin.email,
      },
      admin: {
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        password: admin.password,
        phone: organization.phone,
        consents: {
          privacyPolicyAccepted: Boolean(consents?.privacyPolicyAccepted),
          privacyPolicyVersion: env.privacy.policyVersion,
          marketingEmail: Boolean(consents?.marketingOptIn ?? consents?.marketingEmail),
          marketingSms: false,
        },
      },
      consents: {
        privacyPolicyAccepted: Boolean(consents?.privacyPolicyAccepted),
        privacyPolicyVersion: env.privacy.policyVersion,
        marketingEmail: Boolean(consents?.marketingOptIn ?? consents?.marketingEmail),
        marketingSms: false,
      },
      origin: BOOTSTRAP_ORIGINS.SELF_SIGNUP,
      organizationStatus: 'trial',
      userStatus: 'pending_verification',
      createVerificationToken: true,
      auditContext: {
        ...auditContext,
        metadata: {
          channel: metadata.channel ?? 'SELF_SIGNUP',
          referralCode: metadata.referralCode ?? null,
          promoCode: metadata.promoCode ?? null,
          invitationId: metadata.invitationId ?? null,
          marketingOptIn: Boolean(consents?.marketingOptIn ?? consents?.marketingEmail),
          planCode: planCode ?? null,
        },
      },
    });

    const isPaidPlan = !(result.plan.isTrialPlan || result.plan.code === 'trial');

    return {
      message: SIGNUP_MESSAGE,
      requiresEmailVerification: true,
      emailSent: Boolean(result.emailDelivery?.sent),
      requiresPlanWelcome: isPaidPlan,
      organization: {
        id: result.organization._id,
        name: result.organization.name,
        status: result.organization.status,
      },
      admin: {
        id: result.adminUser._id,
        email: result.adminUser.email,
        status: result.adminUser.status,
        emailVerified: false,
      },
      subscription: {
        id: result.subscription._id,
        planCode: result.plan.code,
        planName: result.plan.name,
        status: result.subscription.status,
        endDate: result.subscription.endDate,
      },
    };
  }
}

export function createSignupBootstrapService() {
  const steps = createDefaultBootstrapSteps();
  appendBootstrapStep(steps, new CreateVerificationTokenStep());
  return new OrganizationBootstrapService(steps);
}

export const signupService = new SignupService();
