/**
 * Clase base para pasos del Setup Wizard (Open/Closed).
 */
export class SetupStep {
  constructor(key) {
    this.key = key;
  }

  /** @returns {Promise<object>} Datos del paso para el cliente */
  async getData(_context) {
    throw new Error(`getData no implementado para el paso ${this.key}`);
  }

  /** @returns {Promise<object>} Resultado del guardado */
  async save(_context, _payload) {
    throw new Error(`save no implementado para el paso ${this.key}`);
  }

  /** @returns {Promise<string[]>} Errores de validación para completar setup */
  async validateForCompletion(_context) {
    return [];
  }
}
