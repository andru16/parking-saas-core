import fs from 'node:fs/promises';
import path from 'node:path';
import { BackupStorageProvider } from './BackupStorageProvider.js';

/**
 * Almacenamiento en disco local (desarrollo / single-node).
 */
export class LocalDiskStorageProvider extends BackupStorageProvider {
  constructor(rootDir) {
    super();
    this.rootDir = rootDir;
  }

  get name() {
    return 'local';
  }

  #resolve(key) {
    const safe = String(key).replace(/\.\./g, '').replace(/^[/\\]+/, '');
    return path.join(this.rootDir, safe);
  }

  async #ensureDir(filePath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  async put({ key, body }) {
    const filePath = this.#resolve(key);
    await this.#ensureDir(filePath);
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    await fs.writeFile(filePath, buffer);
    return { key, sizeBytes: buffer.length };
  }

  async get(key) {
    return fs.readFile(this.#resolve(key));
  }

  async delete(key) {
    try {
      await fs.unlink(this.#resolve(key));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async exists(key) {
    try {
      await fs.access(this.#resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
