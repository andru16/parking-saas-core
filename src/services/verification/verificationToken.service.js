import crypto from 'node:crypto';
import VerificationToken from '#modules/verificationToken/verificationToken.model.js';
import User from '#modules/user/user.model.js';
import env from '#config/env.js';
import { ApiError } from '#utils/ApiError.js';
import { emailService } from '#services/email/email.service.js';

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
   * Invalida tokens previos no usados del mismo tipo.
   * @returns {Promise<{ token: string, expiresAt: Date }>}
   */
  async createEmailVerificationToken({ userId, organizationId, session }) {
    const { token, tokenHash } = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + env.verificationTokenExpiresHours);

    const opts = session ? { session } : undefined;

    await VerificationToken.updateMany(
      { userId, type: 'email_verification', usedAt: null },
      { $set: { usedAt: new Date() } },
      opts,
    );

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
      session ? { session } : undefined,
    );

    return { token, expiresAt };
  }

  /**
   * Confirma el correo con el token en claro (del link).
   */
  async verifyEmailToken(rawToken) {
    const token = String(rawToken ?? '').trim();
    if (!token || token.length < 20) {
      throw new ApiError(400, 'Enlace de verificación inválido');
    }

    const tokenHash = hashToken(token);
    const record = await VerificationToken.findOne({
      tokenHash,
      type: 'email_verification',
    });

    if (!record) {
      throw new ApiError(400, 'Enlace de verificación inválido o ya utilizado');
    }

    if (record.usedAt) {
      throw new ApiError(400, 'Este enlace ya fue utilizado. Puede iniciar sesión.');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new ApiError(400, 'El enlace de verificación expiró. Solicite uno nuevo.');
    }

    const user = await User.findById(record.userId);
    if (!user) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    if (user.emailVerified && user.status === 'active') {
      record.usedAt = new Date();
      await record.save();
      return {
        alreadyVerified: true,
        email: user.email,
        message: 'Su correo ya estaba verificado. Puede iniciar sesión.',
      };
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    if (user.status === 'pending_verification') {
      user.status = 'active';
    }
    await user.save();

    record.usedAt = new Date();
    await record.save();

    return {
      alreadyVerified: false,
      email: user.email,
      message: 'Correo verificado correctamente. Ya puede iniciar sesión.',
    };
  }

  /**
   * Reenvía correo de verificación si la cuenta sigue pendiente.
   */
  async resendVerificationEmail(email) {
    const normalized = String(email ?? '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new ApiError(400, 'El correo es obligatorio');
    }

    const user = await User.findOne({ email: normalized })
      .select('firstName email status emailVerified organizationId')
      .populate('organizationId', 'name')
      .lean();

    // Respuesta genérica para no filtrar existencia de cuentas
    const generic = {
      message:
        'Si el correo está registrado y pendiente de verificación, enviamos un nuevo enlace.',
    };

    if (!user || user.emailVerified || user.status === 'inactive') {
      return generic;
    }

    const { token } = await this.createEmailVerificationToken({
      userId: user._id,
      organizationId: user.organizationId?._id ?? user.organizationId,
    });

    try {
      await emailService.sendVerificationEmail({
        to: user.email,
        token,
        userName: user.firstName,
        organizationName: user.organizationId?.name ?? 'Parking SaaS',
      });
    } catch (error) {
      if (env.email.resendApiKey) {
        throw new ApiError(
          502,
          error.message ||
            'No se pudo reenviar el correo de verificación. Intente de nuevo en unos minutos.',
        );
      }
    }

    return generic;
  }
}

export const verificationTokenService = new VerificationTokenService();
