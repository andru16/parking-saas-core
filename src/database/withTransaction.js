import mongoose from 'mongoose';
import env from '#config/env.js';
import { ApiError } from '#utils/ApiError.js';

const isReplicaSetRequiredError = (error) => {
  const message = error?.message ?? '';
  return (
    message.includes('replica set') || message.includes('Transaction numbers are only allowed')
  );
};

/**
 * Ejecuta una función dentro de una transacción MongoDB.
 * Requiere replica set o MongoDB Atlas en producción.
 *
 * En desarrollo, si no hay replica set, puede ejecutar sin transacción
 * (MONGODB_USE_TRANSACTIONS=false o fallback automático).
 */
export async function withTransaction(handler) {
  if (!env.mongodb.useTransactions) {
    if (env.isProduction) {
      throw new ApiError(
        500,
        'Las transacciones están deshabilitadas — no permitido en producción',
      );
    }
    if (!env.isTest) {
      console.warn(
        '[MongoDB] MONGODB_USE_TRANSACTIONS=false — ejecutando operación sin transacción (solo desarrollo)',
      );
    }
    return handler(null);
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await handler(session);
    });

    return result;
  } catch (error) {
    if (isReplicaSetRequiredError(error) && env.isDevelopment) {
      console.warn(
        '[MongoDB] Sin replica set — reintentando sin transacción. ' +
          'Para transacciones reales: docker compose up -d o habilitar replSet en mongod.',
      );
      return handler(null);
    }

    if (isReplicaSetRequiredError(error)) {
      throw new ApiError(
        500,
        'Las transacciones requieren MongoDB en modo replica set (Atlas o mongod --replSet). ' +
          'En desarrollo local: docker compose up -d y MONGODB_URI con ?replicaSet=rs0',
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
}
