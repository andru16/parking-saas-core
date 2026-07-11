/**
 * Contrato BackupStorageProvider.
 * Adaptadores: local (impl), S3 / Azure / GCS (stubs listos para implementar).
 */
export class BackupStorageProvider {
  /** @returns {string} */
  get name() {
    throw new Error('BackupStorageProvider.name no implementado');
  }

  /**
   * @param {{ key: string, body: Buffer, contentType?: string, metadata?: object }} input
   * @returns {Promise<{ key: string, sizeBytes: number, etag?: string }>}
   */
  async put(_input) {
    throw new Error(`${this.name}: put() no implementado`);
  }

  /**
   * @param {string} key
   * @returns {Promise<Buffer>}
   */
  async get(_key) {
    throw new Error(`${this.name}: get() no implementado`);
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async delete(_key) {
    throw new Error(`${this.name}: delete() no implementado`);
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async exists(_key) {
    throw new Error(`${this.name}: exists() no implementado`);
  }
}
