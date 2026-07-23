/**
 * Vacía la base de datos MongoDB actual (todas las colecciones).
 *
 * Uso:
 *   npm run db:reset -- --confirm
 *   npm run db:reset -- --confirm --seed
 *
 * --confirm  Obligatorio. Sin esto no borra nada.
 * --seed     Tras vaciar, vuelve a crear roles, planes y Super Admin.
 *
 * En NODE_ENV=production exige además: --i-know-what-im-doing
 */
import mongoose from 'mongoose';
import env from '#config/env.js';
import { connectDatabase, disconnectDatabase } from '#database/connection.js';
import { ensurePlatformBootstrap } from '#modules/superAdmin/ensurePlatformBootstrap.js';

const args = new Set(process.argv.slice(2));
const confirmed = args.has('--confirm');
const withSeed = args.has('--seed');
const forceProduction = args.has('--i-know-what-im-doing');

function printUsage() {
  console.log(`
Uso:
  npm run db:reset -- --confirm           # Borra todas las colecciones
  npm run db:reset -- --confirm --seed    # Borra y re-siembra roles/planes/super admin

Producción (NODE_ENV=production):
  npm run db:reset -- --confirm --seed --i-know-what-im-doing
`);
}

async function resetDatabase() {
  if (!confirmed) {
    console.error('Abortado: falta --confirm (protección anti-borrado accidental).');
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (env.isProduction && !forceProduction) {
    console.error(
      'Abortado: NODE_ENV=production. Si realmente quieres borrar la BD de producción, añade --i-know-what-im-doing',
    );
    process.exitCode = 1;
    return;
  }

  await connectDatabase();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('No hay conexión activa a MongoDB');
  }

  const dbName = db.databaseName;
  console.log(`\n⚠  Vaciar base de datos: "${dbName}"`);
  if (env.isProduction) {
    console.log('⚠  ENTORNO DE PRODUCCIÓN');
  }

  const collections = await db.listCollections().toArray();
  if (collections.length === 0) {
    console.log('La base de datos ya está vacía.');
  } else {
    console.log(`Colecciones a eliminar (${collections.length}):`);
    for (const { name } of collections) {
      // system.* no se pueden dropear
      if (name.startsWith('system.')) {
        console.log(`  - ${name} (omitida)`);
        continue;
      }
      await db.dropCollection(name);
      console.log(`  ✓ ${name}`);
    }
  }

  if (withSeed) {
    console.log('\nRe-siembra: roles, planes y Super Admin…');
    const result = await ensurePlatformBootstrap();
    console.log(
      `Listo. Super Admin: ${result.user.email} (${result.created ? 'creado' : 'actualizado'})`,
    );
  } else {
    console.log(
      '\nSin --seed: la BD quedó vacía. Al arrancar el API (`npm run dev`) se recrearán roles/planes/super admin automáticamente.',
    );
  }

  console.log('\nBase de datos reiniciada.\n');
}

try {
  await resetDatabase();
} catch (error) {
  console.error('Error al resetear la base de datos:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
