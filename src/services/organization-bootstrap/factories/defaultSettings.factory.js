/**
 * Construye el registro inicial de configuración (solo organizationId).
 * El Setup Wizard es responsable de definir todos los valores operativos.
 */
import { buildDefaultPaymentMethods } from '#services/payment/paymentMethodCatalog.service.js';

export function buildDefaultSettings(organizationId) {
  return {
    organizationId,
    operatingHours: {
      operatingDays: [],
      operate24Hours: false,
    },
    rounding: {
      mode: 'nearest',
      unitMinutes: 15,
    },
    paymentMethods: buildDefaultPaymentMethods(),
    notifications: {
      subscriptionExpiryAlert: true,
      subscriptionExpiryDays: 3,
    },
  };
}
