import { exportReport } from './exportRegistry.js';

/**
 * Servicio de exportación desacoplado por formato.
 */
export class ReportExportService {
  async export(format, { title, columns, rows }) {
    return exportReport(format, {
      title,
      columns,
      rows: rows.map((row) =>
        columns.map((col) => {
          const value = row[col.key];
          if (value instanceof Date) return value.toISOString();
          if (typeof value === 'boolean') return value ? 'Sí' : 'No';
          return value ?? '';
        }),
      ),
      columnHeaders: columns.map((c) => c.label),
    });
  }
}

export const reportExportService = new ReportExportService();

/** Alias de arquitectura (ReportsExportService). */
export { ReportExportService as ReportsExportService, reportExportService as reportsExportService };
