/**
 * Catálogo y constantes del Centro de Reportes y Analítica.
 */

import { ROLES } from '#modules/auth/constants.js';

export const REPORT_TYPES = Object.freeze({
  TICKETS: 'tickets',
  VEHICLES: 'vehicles',
  MEMBERS: 'members',
  MEMBERSHIPS: 'memberships',
  MEMBERSHIP_PAYMENTS: 'membership-payments',
  FREQUENT_VEHICLES: 'frequent-vehicles',
  FREQUENT_MEMBERS: 'frequent-members',
  PAYMENTS: 'payments',
  CASH_REGISTERS: 'cash-registers',
  USERS: 'users',
  AUDIT: 'audit',
});

/** Agrupación comercial de reportes (UI / meta). */
export const REPORT_CATEGORIES = Object.freeze({
  OPERATION: 'operation',
  FINANCIAL: 'financial',
  CASH: 'cash',
  MEMBERSHIPS: 'memberships',
  USERS: 'users',
});

export const REPORT_CATALOG = Object.freeze([
  {
    type: REPORT_TYPES.TICKETS,
    category: REPORT_CATEGORIES.OPERATION,
    label: 'Tickets (ingresos / salidas)',
    description: 'Operación de tickets por fecha, categoría y estado',
  },
  {
    type: REPORT_TYPES.VEHICLES,
    category: REPORT_CATEGORIES.OPERATION,
    label: 'Vehículos',
    description: 'Vehículos registrados y su categoría',
  },
  {
    type: REPORT_TYPES.PAYMENTS,
    category: REPORT_CATEGORIES.FINANCIAL,
    label: 'Ingresos / Pagos',
    description: 'Cobros por cajero, método y rango de fechas',
  },
  {
    type: REPORT_TYPES.CASH_REGISTERS,
    category: REPORT_CATEGORIES.CASH,
    label: 'Cajas (aperturas / cierres)',
    description: 'Sesiones de caja, fondos y diferencias',
  },
  {
    type: REPORT_TYPES.MEMBERSHIPS,
    category: REPORT_CATEGORIES.MEMBERSHIPS,
    label: 'Membresías',
    description: 'Activas, vencidas y próximas a vencer',
  },
  {
    type: REPORT_TYPES.MEMBERSHIP_PAYMENTS,
    category: REPORT_CATEGORIES.MEMBERSHIPS,
    label: 'Pagos de membresías',
    description: 'Cobros de mensualidades y renovaciones',
  },
  {
    type: REPORT_TYPES.FREQUENT_VEHICLES,
    category: REPORT_CATEGORIES.OPERATION,
    label: 'Vehículos frecuentes',
    description: 'Placas con más ingresos en el período',
  },
  {
    type: REPORT_TYPES.FREQUENT_MEMBERS,
    category: REPORT_CATEGORIES.MEMBERSHIPS,
    label: 'Clientes frecuentes',
    description: 'Miembros con más ingresos al parqueadero',
  },
  {
    type: REPORT_TYPES.MEMBERS,
    category: REPORT_CATEGORIES.MEMBERSHIPS,
    label: 'Miembros',
    description: 'Clientes con relación permanente',
  },
  {
    type: REPORT_TYPES.USERS,
    category: REPORT_CATEGORIES.USERS,
    label: 'Usuarios y actividad',
    description: 'Inicios de sesión y estado de usuarios',
  },
  {
    type: REPORT_TYPES.AUDIT,
    category: REPORT_CATEGORIES.USERS,
    label: 'Auditoría',
    description: 'Acciones registradas en el sistema',
  },
]);

export const EXPORT_FORMATS = Object.freeze({
  CSV: 'csv',
  XLSX: 'xlsx',
  PDF: 'pdf',
});

export const REPORT_AUDIT_ACTIONS = Object.freeze({
  /** Consulta de cualquier reporte (texto amigable en UI). */
  GENERATED: 'report_consulted',
  EXPORTED: 'report_exported',
  /** Legacy — se mantiene por compatibilidad con logs antiguos. */
  SENSITIVE_QUERY: 'report_consulted',
});

export const ROLE_REPORT_ACCESS = Object.freeze({
  [ROLES.SUPER_ADMIN]: Object.values(REPORT_TYPES),
  [ROLES.ORGANIZATION_ADMIN]: Object.values(REPORT_TYPES),
  admin: Object.values(REPORT_TYPES),
  [ROLES.SUPERVISOR]: [
    REPORT_TYPES.TICKETS,
    REPORT_TYPES.VEHICLES,
    REPORT_TYPES.MEMBERS,
    REPORT_TYPES.MEMBERSHIPS,
    REPORT_TYPES.MEMBERSHIP_PAYMENTS,
    REPORT_TYPES.FREQUENT_VEHICLES,
    REPORT_TYPES.FREQUENT_MEMBERS,
    REPORT_TYPES.PAYMENTS,
    REPORT_TYPES.CASH_REGISTERS,
    REPORT_TYPES.USERS,
    REPORT_TYPES.AUDIT,
  ],
  supervisor: [
    REPORT_TYPES.TICKETS,
    REPORT_TYPES.VEHICLES,
    REPORT_TYPES.MEMBERS,
    REPORT_TYPES.MEMBERSHIPS,
    REPORT_TYPES.MEMBERSHIP_PAYMENTS,
    REPORT_TYPES.FREQUENT_VEHICLES,
    REPORT_TYPES.FREQUENT_MEMBERS,
    REPORT_TYPES.PAYMENTS,
    REPORT_TYPES.CASH_REGISTERS,
    REPORT_TYPES.USERS,
    REPORT_TYPES.AUDIT,
  ],
  [ROLES.CASHIER]: [REPORT_TYPES.TICKETS, REPORT_TYPES.PAYMENTS],
  cashier: [REPORT_TYPES.TICKETS, REPORT_TYPES.PAYMENTS],
});

export const DASHBOARD_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ORGANIZATION_ADMIN,
  'admin',
  ROLES.SUPERVISOR,
  'supervisor',
  ROLES.CASHIER,
  'cashier',
];

export const SENSITIVE_REPORT_TYPES = [REPORT_TYPES.AUDIT, REPORT_TYPES.USERS];

export const MEMBERSHIP_EXPIRING_DAYS = 7;
