import env from '#config/env.js';

/**
 * Servicio de correo electrónico.
 * Arquitectura preparada para integración futura (SendGrid, SES, Resend, etc.).
 */
export class EmailService {
  /**
   * Envía el correo de verificación de cuenta.
   * @returns {Promise<{ prepared: boolean, sent: boolean }>}
   */
  async sendVerificationEmail({ to, token, userName, organizationName }) {
    const payload = {
      to,
      subject: 'Verifica tu correo electrónico — Parking SaaS',
      template: 'email-verification',
      data: {
        userName,
        organizationName,
        verificationUrl: `${env.client.url}/verificar-email?token=${token}`,
        expiresInHours: env.verificationTokenExpiresHours,
      },
    };

    if (env.isDevelopment) {
      console.info('[EmailService] Correo de verificación preparado:', {
        to: payload.to,
        verificationUrl: payload.data.verificationUrl,
      });
    }

    // TODO: integrar proveedor de correo real
    return { prepared: true, sent: false, payload };
  }
}

export const emailService = new EmailService();
