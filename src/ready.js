import mongoose from 'mongoose';
import { connectDatabase } from '#database/connection.js';
import { ensurePlatformBootstrap } from '#modules/superAdmin/ensurePlatformBootstrap.js';
import { settingsRepository } from '#modules/systemSettings/settings.repository.js';
import env from '#config/env.js';

let readyPromise = null;

/**
 * Inicializa DB + seeds de plataforma (idempotente, seguro en cold starts).
 * No arranca schedulers in-process (usar cron HTTP / CLI).
 */
export const ensureAppReady = () => {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    if (mongoose.connection.readyState !== 1) {
      await connectDatabase();
    }

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
  })().catch((error) => {
    readyPromise = null;
    throw error;
  });

  return readyPromise;
};
