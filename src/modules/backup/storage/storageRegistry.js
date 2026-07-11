import path from 'node:path';
import env from '#config/env.js';
import { STORAGE_PROVIDERS } from '../constants.js';
import { LocalDiskStorageProvider } from './localDisk.provider.js';
import { S3StorageProvider } from './s3.provider.js';
import { AzureBlobStorageProvider } from './azureBlob.provider.js';
import { GcsStorageProvider } from './gcs.provider.js';
import { ApiError } from '#utils/ApiError.js';

let localProvider = null;

function getLocalProvider() {
  if (!localProvider) {
    const root = path.resolve(process.cwd(), env.backup.localDir);
    localProvider = new LocalDiskStorageProvider(root);
  }
  return localProvider;
}

const stubs = {
  [STORAGE_PROVIDERS.S3]: new S3StorageProvider(),
  [STORAGE_PROVIDERS.AZURE]: new AzureBlobStorageProvider(),
  [STORAGE_PROVIDERS.GCS]: new GcsStorageProvider(),
};

/**
 * @param {string} [providerName]
 * @returns {import('./BackupStorageProvider.js').BackupStorageProvider}
 */
export function getBackupStorageProvider(providerName = STORAGE_PROVIDERS.LOCAL) {
  const name = providerName || env.backup.defaultProvider || STORAGE_PROVIDERS.LOCAL;

  if (name === STORAGE_PROVIDERS.LOCAL) {
    return getLocalProvider();
  }

  const stub = stubs[name];
  if (stub) return stub;

  throw new ApiError(400, `Proveedor de almacenamiento no soportado: ${name}`);
}
