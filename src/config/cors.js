import env from '#config/env.js';

const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
/** Deployments y previews de Vercel (incl. team URLs largas). */
const VERCEL_APP_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;
/** Frontends de este proyecto en Vercel (producción + previews). */
const PARKING_SAAS_CLIENT_ORIGIN_PATTERN =
  /^https:\/\/parking-saas-client[a-z0-9-]*\.vercel\.app$/i;

/**
 * Orígenes fijos de despliegue.
 * Nota: https://parking-saas-core.vercel.app es el API; el Origin del navegador
 * suele ser el client, pero se incluye por si se usa same-stack / tools.
 */
const DEPLOYMENT_ORIGINS = [
  'https://parking-saas-core.vercel.app',
  'https://parking-saas-client.vercel.app',
];

/** Normaliza orígenes para comparar sin barra final ni espacios. */
const normalizeOrigin = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
};

/**
 * Orígenes permitidos: FRONTEND_URL / CLIENT_URL + despliegue + CORS_ORIGINS + localhost.
 */
export const getAllowedOrigins = () => {
  const set = new Set();

  const primary = normalizeOrigin(env.client.url);
  if (primary) set.add(primary);

  const appUrl = normalizeOrigin(env.app.url);
  if (appUrl) set.add(appUrl);

  for (const origin of DEPLOYMENT_ORIGINS) {
    set.add(origin);
  }

  set.add('http://localhost:5173');
  set.add('http://127.0.0.1:5173');

  for (const origin of env.cors.extraOrigins) {
    const normalized = normalizeOrigin(origin);
    if (normalized) set.add(normalized);
  }

  return set;
};

const isAllowedOrigin = (origin) => {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;

  if (getAllowedOrigins().has(normalized)) return true;

  if (PARKING_SAAS_CLIENT_ORIGIN_PATTERN.test(normalized)) return true;

  if (env.isDevelopment && LOCALHOST_ORIGIN_PATTERN.test(normalized)) return true;

  // Previews / deployments *.vercel.app
  if (env.cors.allowVercelPreviews && VERCEL_APP_ORIGIN_PATTERN.test(normalized)) {
    return true;
  }

  return false;
};

/**
 * CORS para API cross-origin (client Vercel ↔ API Vercel) con credentials.
 */
export const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Origen rechazado: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
};
