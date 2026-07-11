import env from '#config/env.js';

const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Normaliza orígenes para comparar sin barra final ni espacios. */
const normalizeOrigin = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
};

/**
 * Orígenes permitidos: FRONTEND_URL / CLIENT_URL + CORS_ORIGINS + localhost en desarrollo.
 */
export const getAllowedOrigins = () => {
  const set = new Set();

  const primary = normalizeOrigin(env.client.url);
  if (primary) set.add(primary);

  // Siempre permitir el frontend de Vite en local
  set.add('http://localhost:5173');
  set.add('http://127.0.0.1:5173');

  for (const origin of env.cors.extraOrigins) {
    const normalized = normalizeOrigin(origin);
    if (normalized) set.add(normalized);
  }

  return set;
};

/**
 * CORS para API cross-origin (client Vercel ↔ API Vercel) con credentials.
 */
export const corsOptions = {
  origin(origin, callback) {
    // Sin Origin: health checks, Postman, Vercel Cron
    if (!origin) {
      return callback(null, true);
    }

    const normalized = normalizeOrigin(origin);
    const allowed = getAllowedOrigins();

    if (allowed.has(normalized)) {
      return callback(null, true);
    }

    if (env.isDevelopment && LOCALHOST_ORIGIN_PATTERN.test(normalized)) {
      return callback(null, true);
    }

    // false (no Error): evita que el errorHandler responda sin headers CORS en el preflight
    console.warn(`[CORS] Origen rechazado: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
};
