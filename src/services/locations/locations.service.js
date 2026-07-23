import { ApiError } from '#utils/ApiError.js';

const API_COLOMBIA_BASE = 'https://api-colombia.com/api/v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Países soportados en selects (Colombia con departamentos/ciudades vía API). */
export const SUPPORTED_COUNTRIES = Object.freeze([
  { code: 'CO', name: 'Colombia' },
  { code: 'MX', name: 'México' },
  { code: 'PE', name: 'Perú' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'CL', name: 'Chile' },
  { code: 'AR', name: 'Argentina' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'PA', name: 'Panamá' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'ES', name: 'España' },
]);

const memoryCache = new Map();

async function cachedJson(key, url) {
  const hit = memoryCache.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.value;
  }

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    throw new ApiError(502, 'No se pudo conectar al servicio de ubicaciones');
  }

  if (!response.ok) {
    throw new ApiError(502, 'El servicio de ubicaciones no está disponible');
  }

  const value = await response.json();
  memoryCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
}

export class LocationsService {
  listCountries() {
    return SUPPORTED_COUNTRIES.map((c) => ({ code: c.code, name: c.name }));
  }

  isColombia(countryNameOrCode) {
    const n = normalizeName(countryNameOrCode);
    return n === 'colombia' || n === 'co';
  }

  async listDepartments(country) {
    if (!this.isColombia(country)) {
      return [];
    }

    const rows = await cachedJson('departments', `${API_COLOMBIA_BASE}/Department`);
    return (Array.isArray(rows) ? rows : [])
      .map((d) => ({
        id: d.id,
        name: d.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async listCitiesByDepartment(departmentId) {
    const id = Number(departmentId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ApiError(400, 'Departamento inválido');
    }

    const rows = await cachedJson(
      `cities:${id}`,
      `${API_COLOMBIA_BASE}/Department/${id}/cities`,
    );

    return (Array.isArray(rows) ? rows : [])
      .map((c) => ({
        id: c.id,
        name: c.name,
        departmentId: c.departmentId ?? id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
}

export const locationsService = new LocationsService();
