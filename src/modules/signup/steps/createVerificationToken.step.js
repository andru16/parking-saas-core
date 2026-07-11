import { BootstrapStep } from '#services/organization-bootstrap/steps/bootstrapStep.js';
import { verificationTokenService } from '#services/verification/verificationToken.service.js';
import { emailService } from '#services/email/email.service.js';

/**
 * Paso opcional del bootstrap: genera token de verificación y prepara el correo.
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

    await emailService.sendVerificationEmail({
      to: context.adminUser.email,
      token,
      userName: context.adminUser.firstName,
      organizationName: context.organization.name,
    });
  }
}
