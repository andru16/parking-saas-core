/**
 * Debe ejecutarse antes de importar módulos que leen env.
 * Vitest inyecta env del config; aquí reforzamos URI del memory server.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URI_FILE = path.join(__dirname, '.mongo-uri');

process.env.NODE_ENV = 'test';
process.env.MONGODB_USE_TRANSACTIONS = 'false';

if (existsSync(URI_FILE)) {
  process.env.MONGODB_URI = readFileSync(URI_FILE, 'utf8').trim();
}

process.env.JWT_ACCESS_SECRET ??=
  'test-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET ??=
  'test-refresh-secret-at-least-32-characters-long';
process.env.SUPER_ADMIN_EMAIL ??= 'superadmin@parkingsaas.test';
process.env.SUPER_ADMIN_PASSWORD ??= 'SuperAdminTest1!';
process.env.BACKUP_SCHEDULER_ENABLED = 'false';
process.env.SUBSCRIPTION_SCHEDULER_ENABLED = 'false';
