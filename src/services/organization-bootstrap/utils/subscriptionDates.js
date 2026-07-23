/**
 * Calcula la fecha de vencimiento sumando días.
 */
export function calculateSubscriptionEndDate(startDate, durationDays) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  return endDate;
}

/**
 * Estado inicial de la organización según el plan (isTrialPlan en BD).
 */
export function resolveOrganizationStatus(plan) {
  // Self-signup siempre inicia en trial (pago → awaiting_activation / trial_premium).
  if (!plan) return 'trial';
  return 'trial';
}
