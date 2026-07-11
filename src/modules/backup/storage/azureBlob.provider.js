import { BackupStorageProvider } from './BackupStorageProvider.js';
import { ApiError } from '#utils/ApiError.js';

/** Stub — Azure Blob Storage (no implementado). */
export class AzureBlobStorageProvider extends BackupStorageProvider {
  get name() {
    return 'azure';
  }

  async put() {
    throw new ApiError(501, 'Almacenamiento Azure Blob aún no está habilitado');
  }

  async get() {
    throw new ApiError(501, 'Almacenamiento Azure Blob aún no está habilitado');
  }

  async delete() {
    throw new ApiError(501, 'Almacenamiento Azure Blob aún no está habilitado');
  }

  async exists() {
    throw new ApiError(501, 'Almacenamiento Azure Blob aún no está habilitado');
  }
}
