/**
 * Semilla inicial de métodos de pago al crear una Organization.
 * En runtime la fuente de verdad es Setting.paymentMethods en la base de datos.
 * No usar este catálogo como fallback en operaciones de cobro.
 */
export const SYSTEM_PAYMENT_METHODS = Object.freeze([
  { code: 'cash', label: 'Efectivo', isSystem: true, displayOrder: 1 },
  { code: 'card', label: 'Tarjeta', isSystem: true, displayOrder: 2 },
  { code: 'transfer', label: 'Transferencia', isSystem: true, displayOrder: 3 },
  { code: 'nequi', label: 'Nequi', isSystem: true, displayOrder: 4 },
  { code: 'daviplata', label: 'Daviplata', isSystem: true, displayOrder: 5 },
  { code: 'other', label: 'Otros', isSystem: true, displayOrder: 6 },
  { code: 'membership', label: 'Membresía', isSystem: true, displayOrder: 99 },
]);

export function buildDefaultPaymentMethods() {
  return SYSTEM_PAYMENT_METHODS.filter((m) => m.code !== 'membership').map((method) => ({
    code: method.code,
    label: method.label,
    enabled: true,
    displayOrder: method.displayOrder,
    isSystem: true,
  }));
}
