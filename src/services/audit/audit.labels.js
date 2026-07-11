/**
 * Etiquetas en español para auditoría orientada al cliente (sin jerga técnica).
 */

import { REPORT_CATALOG } from '#modules/report/constants.js';

const REPORT_TYPE_LABELS = Object.fromEntries(
  REPORT_CATALOG.map((item) => [item.type, item.label]),
);

/** Acciones internas que no deben mostrarse al cliente de la organización. */
export const AUDIT_ACTIONS_HIDDEN_FROM_CLIENT = Object.freeze([
  'refresh_token',
  'token_refresh',
  'admin_refresh_token',
]);

const MODULE_LABELS = Object.freeze({
  auth: 'Acceso',
  report: 'Reportes',
  ticket: 'Tickets',
  tickets: 'Tickets',
  vehicles: 'Vehículos',
  vehicle: 'Vehículos',
  payment: 'Pagos',
  payments: 'Pagos',
  cash_register: 'Caja',
  cash: 'Caja',
  members: 'Miembros',
  member: 'Miembros',
  memberships: 'Membresías',
  membership: 'Membresías',
  users: 'Usuarios',
  roles: 'Roles',
  settings: 'Configuración',
  printing: 'Impresión',
  audit: 'Auditoría',
  backup: 'Backups',
  support: 'Soporte',
  organizations: 'Organización',
  setup: 'Configuración inicial',
  system: 'Sistema',
});

const ACTION_LABELS = Object.freeze({
  login_success: 'Inicio de sesión',
  login_failed: 'Intento de inicio de sesión fallido',
  logout: 'Cierre de sesión',
  refresh_token: 'Renovación de sesión',
  report_generated: 'Consulta de reporte',
  report_consulted: 'Consulta de reporte',
  report_sensitive_query: 'Consulta de reporte',
  report_exported: 'Exportación de reporte',
  ticket_opened: 'Ingreso de vehículo',
  ticket_closed: 'Salida de vehículo',
  ticket_cancelled: 'Ticket anulado',
  cash_register_opened: 'Apertura de caja',
  cash_register_closed: 'Cierre de caja',
  cash_register_adjusted: 'Ajuste de caja',
  payment_created: 'Cobro registrado',
  payment_reversed: 'Cobro anulado',
  vehicle_created: 'Vehículo registrado',
  vehicle_updated: 'Vehículo actualizado',
  user_created: 'Usuario creado',
  user_updated: 'Usuario actualizado',
  user_deactivated: 'Usuario desactivado',
  user_password_changed: 'Cambio de contraseña',
  user_role_changed: 'Cambio de rol',
  settings_section_updated: 'Configuración actualizada',
  audit_viewed: 'Consulta de auditoría',
  audit_exported: 'Exportación de auditoría',
  backup_created: 'Backup iniciado',
  backup_completed: 'Backup completado',
  backup_failed: 'Backup fallido',
  backup_deleted: 'Backup eliminado',
  backup_downloaded: 'Descarga de backup',
  backup_restore_requested: 'Restauración de backup iniciada',
  backup_restore_completed: 'Restauración de backup completada',
  backup_restore_failed: 'Restauración de backup fallida',
  platform_settings_updated: 'Configuración global actualizada',
  support_ticket_created: 'Ticket de soporte creado',
  support_ticket_replied: 'Respuesta en ticket de soporte',
  support_ticket_status_changed: 'Estado de ticket de soporte',
  support_ticket_closed: 'Ticket de soporte cerrado',
  support_ticket_assigned: 'Ticket de soporte asignado',
  member_created: 'Miembro creado',
  member_updated: 'Miembro actualizado',
  member_status_changed: 'Estado de miembro',
  member_vehicle_linked: 'Vehículo asociado a miembro',
  member_vehicle_unlinked: 'Vehículo desasociado de miembro',
  membership_created: 'Membresía creada',
  membership_updated: 'Membresía actualizada',
  membership_status_changed: 'Estado de membresía',
  membership_renewed: 'Membresía renovada',
  membership_used: 'Uso de membresía',
  membership_payment_recorded: 'Pago de membresía registrado',
});

const FORMAT_LABELS = Object.freeze({
  csv: 'CSV',
  xlsx: 'Excel',
  pdf: 'PDF',
});

export function getReportTypeLabel(type) {
  return REPORT_TYPE_LABELS[type] ?? type ?? 'reporte';
}

export function getAuditModuleLabel(module) {
  if (!module) return 'Sistema';
  const key = String(module).toLowerCase();
  return MODULE_LABELS[key] ?? humanizeToken(key);
}

export function getAuditActionLabel(action) {
  if (!action) return 'Actividad';
  const key = String(action).toLowerCase();
  return ACTION_LABELS[key] ?? humanizeToken(key);
}

export function buildReportConsultedDescription(reportType) {
  return `Consultó el reporte: ${getReportTypeLabel(reportType)}`;
}

export function buildReportExportedDescription(reportType, format) {
  const formatLabel = FORMAT_LABELS[format] ?? String(format).toUpperCase();
  return `Exportó el reporte «${getReportTypeLabel(reportType)}» en ${formatLabel}`;
}

/** Humaniza descripciones técnicas guardadas históricamente. */
export function humanizeAuditDescription(description, { action, module } = {}) {
  if (!description || typeof description !== 'string') {
    return getAuditActionLabel(action);
  }

  let text = description.trim();

  // Casos conocidos de reportes
  text = text.replace(/^Reporte generado:\s*/i, 'Consultó el reporte: ');
  text = text.replace(/^Exportación\s+(\w+):\s*/i, (_, fmt) => {
    const formatLabel = FORMAT_LABELS[String(fmt).toLowerCase()] ?? String(fmt).toUpperCase();
    return `Exportó el reporte en ${formatLabel}: `;
  });

  for (const [type, label] of Object.entries(REPORT_TYPE_LABELS)) {
    text = text.replace(new RegExp(`\\b${escapeRegex(type)}\\b`, 'gi'), label);
  }

  // Jerga técnica
  text = text
    .replace(/\bquery\b/gi, 'consulta')
    .replace(/\bsensitive[_\s-]?query\b/gi, 'consulta')
    .replace(/\breport_sensitive_query\b/gi, 'consulta de reporte')
    .replace(/\breport_generated\b/gi, 'consulta de reporte')
    .replace(/\breport_exported\b/gi, 'exportación de reporte')
    .replace(/\brefresh[_\s-]?token\b/gi, 'sesión')
    .replace(/\bRefresh token\b/gi, 'Renovación de sesión');

  if (/^refresh/i.test(text) || text.toLowerCase() === 'refresh token') {
    return 'Renovación de sesión';
  }

  if (text === description && ACTION_LABELS[String(action || '').toLowerCase()]) {
    // Si la descripción sigue siendo el código técnico, preferir etiqueta de acción
    if (/^[a-z0-9_:-]+$/i.test(text) && text.includes('_')) {
      return getAuditActionLabel(action);
    }
  }

  return text || getAuditActionLabel(action) || getAuditModuleLabel(module);
}

function humanizeToken(value) {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
