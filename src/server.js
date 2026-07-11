import env from '#config/env.js';
import { connectDatabase } from '#database/connection.js';
import { ensurePlatformBootstrap } from '#modules/superAdmin/ensurePlatformBootstrap.js';
import { subscriptionScheduler } from '#services/subscription-engine/index.js';
import { backupScheduler } from '#modules/backup/backup.scheduler.js';
import { settingsRepository } from '#modules/systemSettings/settings.repository.js';
import app from './app.js';

const startServer = async () => {
  await connectDatabase();

  try {
    await settingsRepository.ensurePlatformDefaults();
    console.log('System Settings (plataforma) listos');
  } catch (error) {
    console.error('No se pudo inicializar System Settings:', error.message);
  }

  try {
    const result = await ensurePlatformBootstrap();
    console.log(
      result.created
        ? `Super Admin creado: ${env.superAdmin.email}`
        : `Super Admin listo: ${env.superAdmin.email}`,
    );
  } catch (error) {
    console.error('No se pudo inicializar Super Admin:', error.message);
  }

  subscriptionScheduler.start();
  backupScheduler.start();

  app.listen(env.port, () => {
    console.log(`${env.app.name} — API en http://localhost:${env.port}`);
    console.log(`Entorno: ${env.nodeEnv}`);
  });
};

startServer();
