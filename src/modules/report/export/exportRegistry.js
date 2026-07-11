import { EXPORT_FORMATS } from '../constants.js';
import { csvExporter } from './csv.exporter.js';
import { xlsxExporter } from './xlsx.exporter.js';
import { pdfExporter } from './pdf.exporter.js';
import { ApiError } from '#utils/ApiError.js';

const exporters = {
  [EXPORT_FORMATS.CSV]: csvExporter,
  [EXPORT_FORMATS.XLSX]: xlsxExporter,
  [EXPORT_FORMATS.PDF]: pdfExporter,
};

export async function exportReport(format, payload) {
  const exporter = exporters[format];
  if (!exporter) {
    throw new ApiError(400, `Formato de exportación no soportado: ${format}`);
  }
  return exporter.export(payload);
}

export function getExportContentType(format) {
  return exporters[format]?.contentType ?? 'application/octet-stream';
}

export function getExportExtension(format) {
  return exporters[format]?.extension ?? 'bin';
}
