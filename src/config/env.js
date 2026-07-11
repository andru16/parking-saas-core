import dotenv from 'dotenv';

// Local: cargar .env. En Vercel las vars vienen del Project Settings (no hay .env desplegado).
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  dotenv.config({ quiet: true });
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';

/**
 * Variables obligatorias en producción.
 */
const requiredInProduction = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'APP_URL',
  'CLIENT_URL',
  'SUPER_ADMIN_PASSWORD',
];

const DEV_SECRET_MARKERS = [
  'dev-access-secret-change-me',
  'dev-refresh-secret-change-me',
  'change-this-access-secret-in-production',
  'change-this-refresh-secret-in-production',
];

const validateEnv = () => {
  if (!isProduction) return;

  const missing = requiredInProduction.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    const where = process.env.VERCEL
      ? 'Configúralas en Vercel → Project → Settings → Environment Variables (Production) y redespliega.'
      : 'Defínelas en core/.env o en el entorno del proceso.';
    throw new Error(
      `Variables de entorno obligatorias faltantes: ${missing.join(', ')}. ${where}`,
    );
  }

  const access = process.env.JWT_ACCESS_SECRET ?? '';
  const refresh = process.env.JWT_REFRESH_SECRET ?? '';
  if (
    DEV_SECRET_MARKERS.includes(access) ||
    DEV_SECRET_MARKERS.includes(refresh) ||
    access.length < 32 ||
    refresh.length < 32
  ) {
    throw new Error(
      'JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser secretos fuertes (>=32) en producción',
    );
  }

  const saPassword = process.env.SUPER_ADMIN_PASSWORD ?? '';
  if (saPassword === 'change-this-password-in-production') {
    throw new Error('SUPER_ADMIN_PASSWORD debe definirse con un valor seguro en producción');
  }
};

validateEnv();

const env = {
  nodeEnv,
  isDevelopment,
  isProduction,
  isTest: nodeEnv === 'test',
  port: parseInt(process.env.PORT ?? '3000', 10),

  mongodb: {
    uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/parkingsaas',
    /** false = ejecutar sin transacciones (solo desarrollo local sin replica set) */
    useTransactions: process.env.MONGODB_USE_TRANSACTIONS !== 'false',
    options: {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE ?? '10', 10),
      serverSelectionTimeoutMS: parseInt(
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT ?? '5000',
        10,
      ),
    },
  },

  app: {
    name: process.env.APP_NAME ?? 'Parking SaaS',
    url: process.env.APP_URL ?? 'http://localhost:3000',
  },

  client: {
    url: process.env.CLIENT_URL ?? 'http://localhost:5173',
  },

  /** Orígenes extra CORS (previews Vercel, dominios custom). Separados por coma. */
  cors: {
    extraOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },

  superAdmin: {
    firstName: process.env.SUPER_ADMIN_NAME ?? 'Super',
    lastName: process.env.SUPER_ADMIN_LASTNAME ?? 'Admin',
    email: process.env.SUPER_ADMIN_EMAIL ?? 'superadmin@parkingsaas.local',
    password: process.env.SUPER_ADMIN_PASSWORD ?? 'change-this-password-in-production',
  },

  trial: {
    durationDays: parseInt(process.env.TRIAL_DURATION_DAYS ?? '15', 10),
  },

  subscription: {
    /** Días de gracia tras vencer trial/suscripción (0 = suspender de inmediato). */
    gracePeriodDays: parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS ?? '5', 10),
    /** Cron diario del motor (node-cron). Default: 03:00 America-friendly UTC. */
    schedulerCron: process.env.SUBSCRIPTION_SCHEDULER_CRON ?? '0 8 * * *',
    schedulerEnabled:
      process.env.SUBSCRIPTION_SCHEDULER_ENABLED !== 'false' && !process.env.VERCEL,
    /** Días a otorgar al reactivar si la fecha ya venció. */
    reactivationDefaultDays: parseInt(
      process.env.SUBSCRIPTION_REACTIVATION_DAYS ?? '30',
      10,
    ),
  },

  audit: {
    /**
     * Retención en meses (6 | 12 | 24 recomendados).
     * No elimina automáticamente; solo define la política.
     */
    retentionMonths: parseInt(process.env.AUDIT_RETENTION_MONTHS ?? '12', 10),
  },

  backup: {
    /** Directorio relativo al cwd del proceso core (desarrollo). */
    localDir: process.env.BACKUP_LOCAL_DIR ?? 'storage/backups',
    defaultProvider: process.env.BACKUP_STORAGE_PROVIDER ?? 'local',
    /** Cron horario: evalúa orgs due cada hora. */
    schedulerCron: process.env.BACKUP_SCHEDULER_CRON ?? '5 * * * *',
    schedulerEnabled: process.env.BACKUP_SCHEDULER_ENABLED !== 'false' && !process.env.VERCEL,
  },

  verificationTokenExpiresHours: parseInt(process.env.VERIFICATION_TOKEN_EXPIRES_HOURS ?? '24', 10),

  cookies: {
    httpOnly: process.env.COOKIE_HTTP_ONLY !== 'false',
    secure: process.env.COOKIE_SECURE === 'true' || isProduction,
    sameSite: process.env.COOKIE_SAME_SITE ?? (isProduction ? 'none' : 'lax'),
    path: process.env.COOKIE_PATH ?? '/api/auth',
    domain: process.env.COOKIE_DOMAIN?.trim() || null,
  },

  /** Cookies / sesión del backoffice Super Admin (independiente del cliente) */
  adminCookies: {
    path: process.env.ADMIN_COOKIE_PATH ?? '/api/admin/auth',
  },

  rateLimit: {
    login: {
      windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS ?? '900000', 10),
      max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX ?? '10', 10),
    },
    refresh: {
      windowMs: parseInt(process.env.RATE_LIMIT_REFRESH_WINDOW_MS ?? '900000', 10),
      max: parseInt(process.env.RATE_LIMIT_REFRESH_MAX ?? '60', 10),
    },
    signup: {
      windowMs: parseInt(process.env.RATE_LIMIT_SIGNUP_WINDOW_MS ?? '3600000', 10),
      max: parseInt(process.env.RATE_LIMIT_SIGNUP_MAX ?? '5', 10),
    },
    /** Techo global — desactivado por defecto; activar en producción. */
    api: {
      enabled: process.env.RATE_LIMIT_API_ENABLED === 'true',
      windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS ?? '60000', 10),
      max: parseInt(process.env.RATE_LIMIT_API_MAX ?? '300', 10),
    },
  },

  /** @deprecated Usar env.client.url */
  get clientUrl() {
    return this.client.url;
  },

  /** @deprecated Usar env.mongodb.uri */
  get mongodbUri() {
    return this.mongodb.uri;
  },
};

export default env;
