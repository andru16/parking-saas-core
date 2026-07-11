import env from '#config/env.js';
import { ensureAppReady } from './ready.js';
import { subscriptionScheduler } from '#services/subscription-engine/index.js';
import { backupScheduler } from '#modules/backup/backup.scheduler.js';
import app from './app.js';

/**
 * Arranque local / contenedor de larga duración.
 * En Vercel se usa api/index.js (sin listen ni node-cron in-process).
 */
const startServer = async () => {
  await ensureAppReady();

  // En Vercel los jobs van por Cron HTTP; aquí solo proceso persistente.
  if (!process.env.VERCEL) {
    subscriptionScheduler.start();
    backupScheduler.start();
  }

  app.listen(env.port, () => {
    console.log(`${env.app.name} — API en http://localhost:${env.port}`);
    console.log(`Entorno: ${env.nodeEnv}`);
  });
};

startServer().catch((error) => {
  console.error('No se pudo iniciar el servidor:', error);
  process.exit(1);
});
