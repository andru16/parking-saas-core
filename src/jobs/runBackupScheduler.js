/**
 * Job CLI opcional:
 *   node src/jobs/runBackupScheduler.js
 *   npm run job:backups
 */
import { connectDatabase } from '#database/connection.js';
import { backupScheduler } from '#modules/backup/backup.scheduler.js';

const run = async () => {
  await connectDatabase();
  console.log('[job:backups] Inicio');
  const result = await backupScheduler.runDue();
  console.log('[job:backups] Resultado:', JSON.stringify(result, null, 2));
  process.exit(0);
};

run().catch((error) => {
  console.error('[job:backups] Falló:', error);
  process.exit(1);
});
