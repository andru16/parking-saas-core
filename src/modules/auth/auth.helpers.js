/**
 * Extrae metadatos de la petición para auditoría y validación de sesión.
 */
export const getRequestContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

/**
 * Valida que la petición incluya IP y User-Agent para operaciones de auth.
 */
export const assertRequestMetadata = (req) => {
  if (!req.ip) {
    return { valid: false, message: 'No se pudo determinar la dirección IP' };
  }

  if (!req.get('user-agent')) {
    return { valid: false, message: 'User-Agent requerido' };
  }

  return { valid: true };
};
