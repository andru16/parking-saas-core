import { BootstrapStep } from '#services/organization-bootstrap/steps/bootstrapStep.js';
import { verificationTokenService } from '#services/verification/verificationToken.service.js';
import { emailService } from '#services/email/email.service.js';
import { ApiError } from '#utils/ApiError.js';
import env from '#config/env.js';

/**
 * Paso opcional del bootstrap: genera token de verificación y envía el correo.
 * Solo se ejecuta cuando createVerificationToken es true en el input.
 */
export class CreateVerificationTokenStep extends BootstrapStep {
  constructor() {
    super('createVerificationToken');
  }

  async execute(context, session) {
    if (!context.input.createVerificationToken) {
      return;
    }

    const { token, expiresAt } = await verificationTokenService.createEmailVerificationToken({
      userId: context.adminUser._id,
      organizationId: context.organization._id,
      session,
    });

    context.verificationToken = token;
    context.verificationTokenExpiresAt = expiresAt;

    try {
      const delivery = await emailService.sendVerificationEmail({
        to: context.adminUser.email,
        token,
        userName: context.adminUser.firstName,
        organizationName: context.organization.name,
      });
      context.emailDelivery = delivery;
    } catch (error) {
      if (env.email.resendApiKey) {
        throw new ApiError(
          502,
          error.message ||
            'No se pudo enviar el correo de verificación. Intente de nuevo en unos minutos.',
        );
      }
      // Sin Resend: solo logs; no abortar el registro en desarrollo.
      context.emailDelivery = { prepared: true, sent: false, provider: 'none' };
    }
  }
}
