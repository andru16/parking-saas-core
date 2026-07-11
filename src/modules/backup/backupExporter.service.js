import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import {
  BACKUP_COLLECTIONS,
  BACKUP_FORMAT_VERSION,
} from './constants.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Exportador lógico multi-tenant (compatible con MongoDB Atlas).
 * No requiere `mongodump` binario: serializa documentos de la org a JSON.gz.
 */
export class BackupExporterService {
  async exportOrganization(organizationId, { includeAuditLogs = false } = {}) {
    const orgId = new mongoose.Types.ObjectId(organizationId);
    const collections = [];
    const payload = {
      formatVersion: BACKUP_FORMAT_VERSION,
      kind: 'organization_logical_backup',
      organizationId: String(organizationId),
      createdAt: new Date().toISOString(),
      collections: {},
    };

    const defs = [...BACKUP_COLLECTIONS];
    if (includeAuditLogs) {
      defs.push({ name: 'auditlogs', orgField: 'organizationId' });
    }

    for (const def of defs) {
      const col = mongoose.connection.db.collection(def.name);
      const cursor = col.find({ [def.orgField]: orgId });
      const docs = await cursor.toArray();

      const cleaned = docs.map((doc) => {
        const copy = { ...doc };
        for (const field of def.excludeFields ?? []) {
          delete copy[field];
        }
        return copy;
      });

      payload.collections[def.name] = cleaned;
      collections.push({ name: def.name, documentCount: cleaned.length });
    }

    const json = Buffer.from(JSON.stringify(payload), 'utf8');
    const compressed = await gzip(json);
    const checksumSha256 = crypto.createHash('sha256').update(compressed).digest('hex');

    return {
      buffer: compressed,
      checksumSha256,
      collections,
      uncompressedBytes: json.length,
      compressedBytes: compressed.length,
      formatVersion: BACKUP_FORMAT_VERSION,
    };
  }

  async parseArchive(buffer) {
    const raw = await gunzip(buffer);
    const payload = JSON.parse(raw.toString('utf8'));
    if (payload.kind !== 'organization_logical_backup') {
      throw new Error('Archivo de backup inválido');
    }
    return payload;
  }
}

export const backupExporterService = new BackupExporterService();
