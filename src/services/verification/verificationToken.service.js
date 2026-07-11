import crypto from 'node:crypto';
import VerificationToken from '#modules/verificationToken/verificationToken.model.js';
import env from '#config/env.js';

const TOKEN_BYTES = 32;

/**
 * Genera un token seguro y su hash SHA-256.
 */
export function generateSecureToken() {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Gestiona tokens de verificación de correo electrónico.
 */
export class VerificationTokenService {
  /**
   * Crea y persiste un token de verificación de email.
   * @returns {Promise<{ token: string, expiresAt: Date }>}
   */
  async createEmailVerificationToken({ userId, organizationId, session }) {
    const { token, tokenHash } = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + env.verificationTokenExpiresHours);

    await VerificationToken.create(
      [
        {
          userId,
          organizationId,
          tokenHash,
          type: 'email_verification',
          expiresAt,
        },
      ],
      { session },
    );

    return { token, expiresAt };
  }
}

export const verificationTokenService = new VerificationTokenService();
