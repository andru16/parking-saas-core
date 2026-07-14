/**
 * Validadores reutilizables para nombre de persona, correo, teléfono,
 * datos de negocio/lugar y protección básica anti-bot.
 */

/** Letras (incl. acentos), espacios y separadores; sin dígitos. */
export const PERSON_NAME_REGEX =
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '\-.][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;

/** Ciudad / país / departamento: letras y separadores, sin dígitos. */
export const PLACE_NAME_REGEX =
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '\-.][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;

/** Nombre comercial / parqueadero: letras, números y separadores comunes. */
export const BUSINESS_NAME_REGEX =
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+(?:[ &'\-./+][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)*$/;

/** Correo con al menos un punto en el dominio (p. ej. rechaza a@b). */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** NIT / documento fiscal: dígitos con guion opcional. */
export const TAX_ID_REGEX = /^[0-9]{5,15}(-[0-9])?$/;

export const PERSON_NAME_MESSAGE =
  'Solo puede contener letras, espacios y signos permitidos (sin números)';

export const PLACE_NAME_MESSAGE =
  'Solo puede contener letras y espacios (sin números ni símbolos raros)';

export const BUSINESS_NAME_MESSAGE =
  'Use un nombre real (mín. 3 caracteres con letras; no solo números ni texto basura)';

export const ADDRESS_MESSAGE =
  'Indique una dirección válida (mín. 5 caracteres, con letras)';

export const TAX_ID_MESSAGE = 'NIT/documento inválido (ej. 900123456-7)';

export const EMAIL_MESSAGE = 'Formato de correo inválido';

export const PHONE_MESSAGE =
  'Teléfono inválido. Use dígitos con opcional + y separadores; entre 7 y 15 dígitos';

export const BOT_REJECT_MESSAGE = 'No se pudo completar la solicitud. Intenta de nuevo.';

export const ALLOWED_TIMEZONES = [
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/Santiago',
  'America/Buenos_Aires',
  'UTC',
];

export const ALLOWED_CURRENCIES = ['COP', 'USD', 'MXN', 'PEN', 'CLP', 'ARS'];

export const ALLOWED_DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

/** Mínimo de tiempo (ms) que un humano razonable tarda en completar el form. */
export const FORM_MIN_FILL_MS = 1500;

/** Máximo de edad del formulario abierto (2 h). */
export const FORM_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const SPAM_TOKENS = /^(asdf+|qwer+|qwerty|xxxxx+|aaaa+|bbbb+|test|testing|hola|abc+|xxx+|zzz+|asdfgh|123456|password)$/i;

function letterCount(value) {
  return (value.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
}

/** Detecta relleno basura típico de bots / datos falsos. */
export function isLowQualityText(value, { minLetters = 3 } = {}) {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  const compact = trimmed.replace(/\s+/g, '');
  if (compact.length < minLetters) return true;
  if (/^(.)\1+$/i.test(compact)) return true;
  if (SPAM_TOKENS.test(compact)) return true;
  if (letterCount(trimmed) < minLetters) return true;
  return false;
}

export function isValidPersonName(value, { min = 2, max = 150 } = {}) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return false;
  if (/\d/.test(trimmed)) return false;
  if (isLowQualityText(trimmed, { minLetters: Math.min(2, min) })) return false;
  return PERSON_NAME_REGEX.test(trimmed);
}

export function isValidPlaceName(value, { min = 2, max = 100 } = {}) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return false;
  if (/\d/.test(trimmed)) return false;
  if (isLowQualityText(trimmed, { minLetters: 2 })) return false;
  return PLACE_NAME_REGEX.test(trimmed);
}

export function isValidBusinessName(value, { min = 3, max = 150 } = {}) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (isLowQualityText(trimmed, { minLetters: 3 })) return false;
  return BUSINESS_NAME_REGEX.test(trimmed);
}

export function isValidAddress(value, { min = 5, max = 300 } = {}) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return false;
  if (letterCount(trimmed) < 3) return false;
  if (isLowQualityText(trimmed, { minLetters: 3 })) return false;
  return true;
}

export function isValidTaxId(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return TAX_ID_REGEX.test(trimmed);
}

export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

export function isValidPhone(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('-')) return false;
  if (trimmed.includes('+') && !trimmed.startsWith('+')) return false;
  if (trimmed.startsWith('+') && !/^\+[0-9]/.test(trimmed)) return false;
  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) return false;
  if (/--|-\s+-|\(\)/.test(trimmed)) return false;

  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Protección anti-bot: honeypot vacío + tiempo mínimo de llenado.
 * @param {{ website?: string, formStartedAt?: number|string }} payload
 */
export function assertBotGuard(payload = {}) {
  const website = typeof payload.website === 'string' ? payload.website.trim() : payload.website;
  if (website) {
    throw new Error(BOT_REJECT_MESSAGE);
  }

  const startedAt = Number(payload.formStartedAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    throw new Error(BOT_REJECT_MESSAGE);
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed < FORM_MIN_FILL_MS || elapsed > FORM_MAX_AGE_MS) {
    throw new Error(BOT_REJECT_MESSAGE);
  }

  return true;
}

export function assertPersonName(value, label = 'El nombre') {
  if (!isValidPersonName(value)) {
    throw new Error(`${label}: ${PERSON_NAME_MESSAGE}`);
  }
  return true;
}

export function assertPlaceName(value, label = 'El campo') {
  if (!isValidPlaceName(value)) {
    throw new Error(`${label}: ${PLACE_NAME_MESSAGE}`);
  }
  return true;
}

export function assertBusinessName(value, label = 'El nombre') {
  if (!isValidBusinessName(value)) {
    throw new Error(`${label}: ${BUSINESS_NAME_MESSAGE}`);
  }
  return true;
}

export function assertAddress(value, label = 'La dirección') {
  if (!isValidAddress(value)) {
    throw new Error(`${label}: ${ADDRESS_MESSAGE}`);
  }
  return true;
}

export function assertTaxId(value) {
  if (!isValidTaxId(value)) {
    throw new Error(TAX_ID_MESSAGE);
  }
  return true;
}

export function assertEmail(value) {
  if (!isValidEmail(value)) {
    throw new Error(EMAIL_MESSAGE);
  }
  return true;
}

export function assertPhone(value) {
  if (!isValidPhone(value)) {
    throw new Error(PHONE_MESSAGE);
  }
  return true;
}
