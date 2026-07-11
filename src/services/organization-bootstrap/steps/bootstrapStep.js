/**
 * Contrato base para pasos del bootstrap (Open/Closed).
 * Cada paso implementa execute(context, session).
 */
export class BootstrapStep {
  constructor(name) {
    this.name = name;
  }

  async execute() {
    throw new Error(`El paso "${this.name}" debe implementar execute()`);
  }
}
