/**
 * Motor de tarifas — cálculo básico al momento de la salida.
 * Usa el snapshot congelado en el Ticket (inmutabilidad histórica).
 *
 * Modalidades:
 * - per_minute / per_hour / hour_fraction / daily → con gracia
 * - fixed → monto único por estadía (la gracia NO anula el cobro)
 */
export class RateCalculatorService {
  /**
   * @param {object} rateSnapshot - Snapshot almacenado en el ticket
   * @param {number} durationMinutes - Minutos de permanencia
   * @param {number} [orgGraceMinutes=0] - Gracia operativa de la organización
   */
  calculate(rateSnapshot, durationMinutes, orgGraceMinutes = 0) {
    const mode = rateSnapshot.billingMode;
    const value = rateSnapshot.value ?? 0;
    const grace =
      mode === 'fixed' ? 0 : (rateSnapshot.graceMinutes ?? 0) + (orgGraceMinutes ?? 0);
    const billableMinutes = Math.max(0, durationMinutes - grace);

    if (mode !== 'fixed' && billableMinutes === 0) {
      return {
        total: 0,
        breakdown: {
          durationMinutes,
          graceMinutes: grace,
          billableMinutes: 0,
          billingMode: mode,
          reason: 'within_grace_period',
        },
      };
    }

    let total = 0;

    switch (mode) {
      case 'per_minute':
        total = billableMinutes * value;
        break;
      case 'per_hour':
        total = Math.ceil(billableMinutes / 60) * value;
        break;
      case 'hour_fraction': {
        const fraction = rateSnapshot.minFractionMinutes ?? 60;
        const fractions = Math.ceil(Math.max(billableMinutes, 1) / fraction);
        total = fractions * (rateSnapshot.fractionPrice ?? value);
        break;
      }
      case 'fixed':
        // Precio único por ingreso, independiente del tiempo.
        total = value;
        break;
      case 'daily':
        total = Math.ceil(Math.max(billableMinutes, 1) / (24 * 60)) * value;
        break;
      default:
        total = Math.ceil(billableMinutes / 60) * value;
    }

    if (rateSnapshot.maxDailyCharge != null && total > rateSnapshot.maxDailyCharge) {
      total = rateSnapshot.maxDailyCharge;
    }

    total = Math.round(total * 100) / 100;

    return {
      total,
      breakdown: {
        durationMinutes,
        graceMinutes: grace,
        billableMinutes: mode === 'fixed' ? durationMinutes : billableMinutes,
        billingMode: mode,
        unitValue: value,
        calculatedTotal: total,
      },
    };
  }
}

export const rateCalculatorService = new RateCalculatorService();
