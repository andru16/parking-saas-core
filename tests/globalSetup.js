import { MongoMemoryServer } from 'mongodb-memory-server';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URI_FILE = path.join(__dirname, '.mongo-uri');

export async function setup() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('parkingsaas_test');
  writeFileSync(URI_FILE, uri, 'utf8');
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_USE_TRANSACTIONS = 'false';

  return async () => {
    await mongod.stop();
    if (existsSync(URI_FILE)) unlinkSync(URI_FILE);
  };
}
