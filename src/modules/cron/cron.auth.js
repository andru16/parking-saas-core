import env from '#config/env.js';

/**
 * Autoriza invocaciones de Vercel Cron / cron externo.
 * Con CRON_SECRET: Authorization Bearer o header x-cron-secret.
 * Sin CRON_SECRET en producción: rechaza (excepto desarrollo).
 */
export const requireCronSecret = (req, res, next) => {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    if (env.isDevelopment) return next();
    return res.status(503).json({
      success: false,
      message: 'CRON_SECRET no configurado',
    });
  }

  const auth = req.headers.authorization ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const headerSecret = req.headers['x-cron-secret'];

  if (bearer === secret || headerSecret === secret) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'No autorizado',
  });
};
