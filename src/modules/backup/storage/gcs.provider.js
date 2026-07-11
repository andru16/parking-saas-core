import { BackupStorageProvider } from './BackupStorageProvider.js';
import { ApiError } from '#utils/ApiError.js';

/** Stub — Google Cloud Storage (no implementado). */
export class GcsStorageProvider extends BackupStorageProvider {
  get name() {
    return 'gcs';
  }

  async put() {
    throw new ApiError(501, 'Almacenamiento Google Cloud Storage aún no está habilitado');
  }

  async get() {
    throw new ApiError(501, 'Almacenamiento Google Cloud Storage aún no está habilitado');
  }

  async delete() {
    throw new ApiError(501, 'Almacenamiento Google Cloud Storage aún no está habilitado');
  }

  async exists() {
    throw new ApiError(501, 'Almacenamiento Google Cloud Storage aún no está habilitado');
  }
}
