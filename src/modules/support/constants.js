/**
 * Constantes del Centro de Soporte (Help Desk).
 */

export const SUPPORT_CATEGORIES = Object.freeze({
  SYSTEM_ERROR: 'system_error',
  TECHNICAL: 'technical',
  QUESTION: 'question',
  FEATURE_REQUEST: 'feature_request',
  BILLING: 'billing',
  CONFIGURATION: 'configuration',
  OTHER: 'other',
});

export const SUPPORT_CATEGORY_LABELS = Object.freeze({
  [SUPPORT_CATEGORIES.SYSTEM_ERROR]: 'Error del sistema',
  [SUPPORT_CATEGORIES.TECHNICAL]: 'Problema técnico',
  [SUPPORT_CATEGORIES.QUESTION]: 'Duda',
  [SUPPORT_CATEGORIES.FEATURE_REQUEST]: 'Nueva funcionalidad',
  [SUPPORT_CATEGORIES.BILLING]: 'Facturación',
  [SUPPORT_CATEGORIES.CONFIGURATION]: 'Configuración',
  [SUPPORT_CATEGORIES.OTHER]: 'Otro',
});

export const SUPPORT_PRIORITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const SUPPORT_PRIORITY_LABELS = Object.freeze({
  [SUPPORT_PRIORITIES.LOW]: 'Baja',
  [SUPPORT_PRIORITIES.MEDIUM]: 'Media',
  [SUPPORT_PRIORITIES.HIGH]: 'Alta',
  [SUPPORT_PRIORITIES.CRITICAL]: 'Crítica',
});

export const SUPPORT_STATUSES = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  WAITING_CUSTOMER: 'waiting_customer',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
});

export const SUPPORT_STATUS_LABELS = Object.freeze({
  [SUPPORT_STATUSES.OPEN]: 'Abierto',
  [SUPPORT_STATUSES.IN_PROGRESS]: 'En proceso',
  [SUPPORT_STATUSES.WAITING_CUSTOMER]: 'Esperando respuesta del cliente',
  [SUPPORT_STATUSES.RESOLVED]: 'Resuelto',
  [SUPPORT_STATUSES.CLOSED]: 'Cerrado',
});

export const SUPPORT_AUTHOR_TYPES = Object.freeze({
  ORGANIZATION_USER: 'organization_user',
  PLATFORM_USER: 'platform_user',
  SYSTEM: 'system',
});

export const SUPPORT_AUDIT_ACTIONS = Object.freeze({
  CREATED: 'support_ticket_created',
  REPLIED: 'support_ticket_replied',
  STATUS_CHANGED: 'support_ticket_status_changed',
  CLOSED: 'support_ticket_closed',
  ASSIGNED: 'support_ticket_assigned',
});

/** Prep. escalabilidad futura */
export const SUPPORT_FEATURES = Object.freeze({
  REALTIME_CHAT: false,
  KNOWLEDGE_BASE: false,
  AI_REPLIES: false,
  WHATSAPP: false,
  EMAIL: false,
  ATTACHMENTS: false,
});
