import { BackupStorageProvider } from './BackupStorageProvider.js';
import { ApiError } from '#utils/ApiError.js';

/** Stub — Amazon S3 (no implementado). */
export class S3StorageProvider extends BackupStorageProvider {
  get name() {
    return 's3';
  }

  async put() {
    throw new ApiError(501, 'Almacenamiento Amazon S3 aún no está habilitado');
  }

  async get() {
    throw new ApiError(501, 'Almacenamiento Amazon S3 aún no está habilitado');
  }

  async delete() {
    throw new ApiError(501, 'Almacenamiento Amazon S3 aún no está habilitado');
  }

  async exists() {
    throw new ApiError(501, 'Almacenamiento Amazon S3 aún no está habilitado');
  }
}
