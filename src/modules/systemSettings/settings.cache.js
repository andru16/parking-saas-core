/**
 * SettingsCache — cache en memoria con invalidación explícita.
 * Evita lecturas repetidas a MongoDB para config de plataforma y org.
 */
export class SettingsCache {
  #store = new Map();
  #ttlMs;

  constructor({ ttlMs = 60_000 } = {}) {
    this.#ttlMs = ttlMs;
  }

  #pack(value) {
    return { value, expiresAt: Date.now() + this.#ttlMs };
  }

  get(key) {
    const entry = this.#store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.#store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this.#store.set(key, this.#pack(value));
    return value;
  }

  invalidate(key) {
    if (key) this.#store.delete(key);
  }

  invalidatePrefix(prefix) {
    for (const k of this.#store.keys()) {
      if (String(k).startsWith(prefix)) this.#store.delete(k);
    }
  }

  clear() {
    this.#store.clear();
  }

  static orgKey(organizationId) {
    return `org:${organizationId}`;
  }

  static orgSectionKey(organizationId, sectionKey) {
    return `org:${organizationId}:section:${sectionKey}`;
  }

  static platformKey() {
    return 'platform:global';
  }
}

export const settingsCache = new SettingsCache({ ttlMs: 60_000 });
