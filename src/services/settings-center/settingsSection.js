/**
 * Contrato base de una sección del Centro de Configuración.
 * Cada sección es un servicio independiente (SRP).
 */
export class SettingsSection {
  /**
   * @param {string} key
   * @param {{ label: string, description: string }} meta
   */
  constructor(key, meta) {
    this.key = key;
    this.label = meta.label;
    this.description = meta.description;
  }

  getMeta() {
    return {
      key: this.key,
      label: this.label,
      description: this.description,
    };
  }

  /**
   * @param {{ organizationId: string, userId?: string }} context
   * @returns {Promise<object>}
   */
  async get(_context) {
    throw new Error(`get() no implementado en sección ${this.key}`);
  }

  /**
   * @param {{ organizationId: string, userId?: string }} context
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async save(_context, _payload) {
    throw new Error(`save() no implementado en sección ${this.key}`);
  }
}
