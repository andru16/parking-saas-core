/**
 * Catálogo global de permisos (módulo:acción).
 * No se hardcodean en componentes UI: se importan desde aquí / API.
 */
export const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'dashboard:view',

  VEHICLES_VIEW: 'vehicles:view',
  VEHICLES_CREATE: 'vehicles:create',
  VEHICLES_UPDATE: 'vehicles:update',
  VEHICLES_DEACTIVATE: 'vehicles:deactivate',

  TICKETS_CREATE: 'tickets:create',
  TICKETS_CLOSE: 'tickets:close',
  TICKETS_CANCEL: 'tickets:cancel',

  CASH_OPEN: 'cash:open',
  CASH_CLOSE: 'cash:close',
  CASH_VIEW: 'cash:view',

  PAYMENTS_COLLECT: 'payments:collect',
  PAYMENTS_REVERSE: 'payments:reverse',
  PAYMENTS_VIEW: 'payments:view',

  MEMBERS_MANAGE: 'members:manage',
  MEMBERSHIPS_MANAGE: 'memberships:manage',

  REPORTS_VIEW: 'reports:view',

  AUDIT_VIEW: 'audit:view',

  SETTINGS_MANAGE: 'settings:manage',
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',

  PRINTING_CONFIG: 'printing:config',
  PRINTING_PRINT: 'printing:print',
  PRINTING_REPRINT: 'printing:reprint',

  BACKUPS_VIEW: 'backups:view',
  BACKUPS_MANAGE: 'backups:manage',
  BACKUPS_RESTORE: 'backups:restore',

  SUPPORT_VIEW: 'support:view',
  SUPPORT_CREATE: 'support:create',
  SUPPORT_REPLY: 'support:reply',
  SUPPORT_CLOSE: 'support:close',
});

/** Agrupación para UI de gestión de permisos */
export const PERMISSION_MODULES = Object.freeze([
  {
    key: 'dashboard',
    label: 'Dashboard',
    permissions: [{ code: PERMISSIONS.DASHBOARD_VIEW, label: 'Ver' }],
  },
  {
    key: 'vehicles',
    label: 'Vehículos',
    permissions: [
      { code: PERMISSIONS.VEHICLES_VIEW, label: 'Ver' },
      { code: PERMISSIONS.VEHICLES_CREATE, label: 'Crear' },
      { code: PERMISSIONS.VEHICLES_UPDATE, label: 'Editar' },
      { code: PERMISSIONS.VEHICLES_DEACTIVATE, label: 'Desactivar' },
    ],
  },
  {
    key: 'tickets',
    label: 'Tickets',
    permissions: [
      { code: PERMISSIONS.TICKETS_CREATE, label: 'Crear' },
      { code: PERMISSIONS.TICKETS_CLOSE, label: 'Cerrar' },
      { code: PERMISSIONS.TICKETS_CANCEL, label: 'Cancelar' },
    ],
  },
  {
    key: 'cash',
    label: 'Caja',
    permissions: [
      { code: PERMISSIONS.CASH_VIEW, label: 'Ver' },
      { code: PERMISSIONS.CASH_OPEN, label: 'Abrir' },
      { code: PERMISSIONS.CASH_CLOSE, label: 'Cerrar' },
    ],
  },
  {
    key: 'payments',
    label: 'Pagos',
    permissions: [
      { code: PERMISSIONS.PAYMENTS_VIEW, label: 'Ver' },
      { code: PERMISSIONS.PAYMENTS_COLLECT, label: 'Cobrar' },
      { code: PERMISSIONS.PAYMENTS_REVERSE, label: 'Reversar' },
    ],
  },
  {
    key: 'members',
    label: 'Miembros',
    permissions: [{ code: PERMISSIONS.MEMBERS_MANAGE, label: 'Administrar' }],
  },
  {
    key: 'memberships',
    label: 'Membresías',
    permissions: [{ code: PERMISSIONS.MEMBERSHIPS_MANAGE, label: 'Administrar' }],
  },
  {
    key: 'reports',
    label: 'Reportes',
    permissions: [{ code: PERMISSIONS.REPORTS_VIEW, label: 'Ver' }],
  },
  {
    key: 'audit',
    label: 'Auditoría',
    permissions: [{ code: PERMISSIONS.AUDIT_VIEW, label: 'Ver' }],
  },
  {
    key: 'settings',
    label: 'Configuración',
    permissions: [{ code: PERMISSIONS.SETTINGS_MANAGE, label: 'Administrar' }],
  },
  {
    key: 'users',
    label: 'Usuarios',
    permissions: [{ code: PERMISSIONS.USERS_MANAGE, label: 'Administrar' }],
  },
  {
    key: 'roles',
    label: 'Roles',
    permissions: [{ code: PERMISSIONS.ROLES_MANAGE, label: 'Administrar' }],
  },
  {
    key: 'printing',
    label: 'Impresión',
    permissions: [
      { code: PERMISSIONS.PRINTING_CONFIG, label: 'Configurar' },
      { code: PERMISSIONS.PRINTING_PRINT, label: 'Imprimir' },
      { code: PERMISSIONS.PRINTING_REPRINT, label: 'Reimprimir' },
    ],
  },
  {
    key: 'backups',
    label: 'Backups',
    permissions: [
      { code: PERMISSIONS.BACKUPS_VIEW, label: 'Ver' },
      { code: PERMISSIONS.BACKUPS_MANAGE, label: 'Administrar' },
      { code: PERMISSIONS.BACKUPS_RESTORE, label: 'Restaurar' },
    ],
  },
  {
    key: 'support',
    label: 'Soporte',
    permissions: [
      { code: PERMISSIONS.SUPPORT_VIEW, label: 'Ver' },
      { code: PERMISSIONS.SUPPORT_CREATE, label: 'Crear' },
      { code: PERMISSIONS.SUPPORT_REPLY, label: 'Responder' },
      { code: PERMISSIONS.SUPPORT_CLOSE, label: 'Cerrar' },
    ],
  },
]);

export const ALL_PERMISSION_CODES = Object.freeze(
  PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.code)),
);

export function isValidPermissionCode(code) {
  return ALL_PERMISSION_CODES.includes(code);
}
