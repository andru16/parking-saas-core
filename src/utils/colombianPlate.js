/**
 * Formatos de placa colombiana y resolución de categoría.
 *
 * - Carro: 3 letras + 3 números → CBF424
 * - Moto antigua: 3 letras + 2 números → UMO47
 * - Moto 2000+: 3 letras + 2 números + 1 letra → ZGT26F
 */

export function normalizePlate(plate) {
  if (typeof plate !== 'string') return '';
  return plate.replace(/[\s\-.]/g, '').toUpperCase();
}

/** @returns {'car'|'moto'|'unknown'} */
export function detectColombianPlateKind(plate) {
  const p = normalizePlate(plate);
  if (!p) return 'unknown';
  if (/^[A-Z]{3}\d{3}$/.test(p)) return 'car';
  if (/^[A-Z]{3}\d{2}[A-Z]$/.test(p)) return 'moto';
  if (/^[A-Z]{3}\d{2}$/.test(p)) return 'moto';
  return 'unknown';
}

export function isValidColombianPlate(plate) {
  return detectColombianPlateKind(plate) !== 'unknown';
}

function categoryKind(category) {
  const icon = String(category?.icon ?? '').toLowerCase();
  const name = String(category?.name ?? '').toLowerCase();

  if (icon === 'car' || /carro|auto|veh[ií]culo|camioneta|autom[oó]vil/.test(name)) {
    return 'car';
  }
  if (
    icon === 'motorcycle' ||
    icon === 'moto' ||
    /moto/.test(name)
  ) {
    return 'moto';
  }
  if (icon === 'bicycle' || /bici/.test(name)) {
    return 'bike';
  }
  return 'other';
}

/**
 * Resuelve categoría a partir de la placa y categorías activas.
 * @param {string} plate
 * @param {Array<{ id?: string, _id?: string, name?: string, icon?: string }>} categories
 */
export function resolveCategoryFromPlate(plate, categories = []) {
  const list = Array.isArray(categories) ? categories : [];
  const withId = list.map((c) => ({
    ...c,
    id: String(c.id ?? c._id ?? ''),
    kind: categoryKind(c),
  })).filter((c) => c.id);

  if (withId.length === 0) {
    return {
      categoryId: null,
      autoDetected: false,
      reason: 'no_categories',
      plateKind: detectColombianPlateKind(plate),
      message: 'No hay categorías activas configuradas',
    };
  }

  const plateKind = detectColombianPlateKind(plate);
  const cars = withId.filter((c) => c.kind === 'car');
  const motos = withId.filter((c) => c.kind === 'moto');
  const onlyCars = cars.length > 0 && motos.length === 0;
  const onlyMotos = motos.length > 0 && cars.length === 0;

  if (withId.length === 1) {
    const only = withId[0];
    if (plate && plateKind !== 'unknown') {
      if (only.kind === 'car' && plateKind === 'moto') {
        return {
          categoryId: null,
          autoDetected: false,
          reason: 'plate_kind_mismatch',
          plateKind,
          message: 'La placa parece de moto, pero este parqueadero solo opera carros',
        };
      }
      if (only.kind === 'moto' && plateKind === 'car') {
        return {
          categoryId: null,
          autoDetected: false,
          reason: 'plate_kind_mismatch',
          plateKind,
          message: 'La placa parece de carro, pero este parqueadero solo opera motos',
        };
      }
    }
    return {
      categoryId: only.id,
      autoDetected: true,
      reason: 'single_category',
      plateKind,
      message: null,
    };
  }

  if (plate && plateKind === 'car' && onlyMotos) {
    return {
      categoryId: null,
      autoDetected: false,
      reason: 'plate_kind_mismatch',
      plateKind,
      message: 'La placa parece de carro, pero este parqueadero solo opera motos',
    };
  }

  if (plate && plateKind === 'moto' && onlyCars) {
    return {
      categoryId: null,
      autoDetected: false,
      reason: 'plate_kind_mismatch',
      plateKind,
      message: 'La placa parece de moto, pero este parqueadero solo opera carros',
    };
  }

  if (plateKind === 'car' || plateKind === 'moto') {
    const matches = withId.filter((c) => c.kind === plateKind);
    if (matches.length === 1) {
      return {
        categoryId: matches[0].id,
        autoDetected: true,
        reason: 'plate_format',
        plateKind,
        message: null,
      };
    }
  }

  return {
    categoryId: null,
    autoDetected: false,
    reason: plateKind === 'unknown' ? 'unknown_format' : 'ambiguous',
    plateKind,
    message: null,
  };
}
