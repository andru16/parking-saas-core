import { PERMISSIONS, ALL_PERMISSION_CODES } from './permission.catalog.js';

/**
 * Roles iniciales por Organization (editables después del bootstrap).
 * key estable para mapeos internos; name visible al admin.
 */
export const DEFAULT_ORG_ROLE_TEMPLATES = Object.freeze([
  {
    key: 'admin',
    name: 'Administrador',
    description: 'Acceso completo a la configuración y operación del parqueadero.',
    isSystem: true,
    permissions: [...ALL_PERMISSION_CODES],
  },
  {
    key: 'supervisor',
    name: 'Supervisor',
    description: 'Supervisa operación, reportes y puede cancelar tickets.',
    isSystem: true,
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.VEHICLES_VIEW,
      PERMISSIONS.VEHICLES_CREATE,
      PERMISSIONS.VEHICLES_UPDATE,
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_CLOSE,
      PERMISSIONS.TICKETS_CANCEL,
      PERMISSIONS.CASH_VIEW,
      PERMISSIONS.CASH_OPEN,
      PERMISSIONS.CASH_CLOSE,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.PAYMENTS_COLLECT,
      PERMISSIONS.PAYMENTS_REVERSE,
      PERMISSIONS.MEMBERS_MANAGE,
      PERMISSIONS.MEMBERSHIPS_MANAGE,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.PRINTING_PRINT,
      PERMISSIONS.PRINTING_REPRINT,
      PERMISSIONS.SUPPORT_VIEW,
      PERMISSIONS.SUPPORT_CREATE,
      PERMISSIONS.SUPPORT_REPLY,
      PERMISSIONS.SUPPORT_CLOSE,
    ],
  },
  {
    key: 'cashier',
    name: 'Cajero',
    description: 'Operación diaria: ingresos, cobros y caja.',
    isSystem: true,
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.VEHICLES_VIEW,
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_CLOSE,
      PERMISSIONS.CASH_VIEW,
      PERMISSIONS.CASH_OPEN,
      PERMISSIONS.CASH_CLOSE,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.PAYMENTS_COLLECT,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.PRINTING_PRINT,
      PERMISSIONS.PRINTING_REPRINT,
      PERMISSIONS.SUPPORT_VIEW,
      PERMISSIONS.SUPPORT_CREATE,
      PERMISSIONS.SUPPORT_REPLY,
    ],
  },
]);
