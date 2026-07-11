import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

/**
 * Servicio de gestión de contraseñas con bcrypt.
 */
export class PasswordService {
  /**
   * Genera un hash seguro de la contraseña.
   */
  async hash(plainPassword) {
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  }

  /**
   * Compara una contraseña en texto plano con su hash.
   */
  async compare(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

export const passwordService = new PasswordService();
