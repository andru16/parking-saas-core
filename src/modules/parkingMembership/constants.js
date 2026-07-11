/**
 * Constantes del dominio Members / Memberships / Vehicles (consulta).
 */

export const MEMBERSHIP_STATUSES = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
});

/** Estado derivado para UI/reportes (no persistido). */
export const MEMBERSHIP_DERIVED = Object.freeze({
  EXPIRING: 'expiring',
});

export const MEMBERSHIP_EXPIRING_DAYS = 7;

export const MEMBER_AUDIT = Object.freeze({
  CREATED: 'member_created',
  UPDATED: 'member_updated',
  STATUS_CHANGED: 'member_status_changed',
  VEHICLE_LINKED: 'member_vehicle_linked',
  VEHICLE_UNLINKED: 'member_vehicle_unlinked',
});

export const MEMBERSHIP_AUDIT = Object.freeze({
  CREATED: 'membership_created',
  UPDATED: 'membership_updated',
  STATUS_CHANGED: 'membership_status_changed',
  RENEWED: 'membership_renewed',
  USED: 'membership_used',
  PAYMENT_RECORDED: 'membership_payment_recorded',
});

export const VEHICLE_AUDIT = Object.freeze({
  UPDATED: 'vehicle_updated',
  MEMBER_LINKED: 'vehicle_member_linked',
});

/**
 * Resuelve estado efectivo para listados.
 * @returns {'active'|'expiring'|'expired'|'suspended'|'cancelled'}
 */
export function resolveMembershipDisplayStatus(doc, now = new Date(), expiringDays = MEMBERSHIP_EXPIRING_DAYS) {
  if (!doc) return MEMBERSHIP_STATUSES.EXPIRED;
  if (doc.status === MEMBERSHIP_STATUSES.CANCELLED) return MEMBERSHIP_STATUSES.CANCELLED;
  if (doc.status === MEMBERSHIP_STATUSES.SUSPENDED) return MEMBERSHIP_STATUSES.SUSPENDED;
  if (doc.status === MEMBERSHIP_STATUSES.EXPIRED) return MEMBERSHIP_STATUSES.EXPIRED;

  const end = new Date(doc.endDate);
  if (end < now) return MEMBERSHIP_STATUSES.EXPIRED;

  const ms = expiringDays * 86400000;
  if (end.getTime() - now.getTime() <= ms) return MEMBERSHIP_DERIVED.EXPIRING;

  return MEMBERSHIP_STATUSES.ACTIVE;
}
