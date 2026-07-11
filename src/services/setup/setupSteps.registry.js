import { GeneralInfoStep } from './steps/generalInfo.step.js';
import { OperationalStep } from './steps/operational.step.js';
import { VehicleCategoriesStep } from './steps/vehicleCategories.step.js';
import { RatesStep } from './steps/rates.step.js';
import { CashPointStep } from './steps/cashPoint.step.js';
import { SETUP_STEP_ORDER } from './constants.js';

const stepInstances = [
  new GeneralInfoStep(),
  new OperationalStep(),
  new VehicleCategoriesStep(),
  new RatesStep(),
  new CashPointStep(),
];

const stepMap = new Map(stepInstances.map((step) => [step.key, step]));

/**
 * Registro de pasos del Setup Wizard (Open/Closed).
 * Agregar un paso nuevo: crear clase, instanciar y añadir a SETUP_STEP_ORDER.
 */
export function getSetupStep(key) {
  const step = stepMap.get(key);

  if (!step) {
    throw new Error(`Paso de setup desconocido: ${key}`);
  }

  return step;
}

export function getAllSetupSteps() {
  return SETUP_STEP_ORDER.filter((key) => key !== 'summary').map((key) => getSetupStep(key));
}

export function getNextStepKey(currentKey) {
  const index = SETUP_STEP_ORDER.indexOf(currentKey);
  if (index === -1 || index >= SETUP_STEP_ORDER.length - 1) return null;
  return SETUP_STEP_ORDER[index + 1];
}

export function getPreviousStepKey(currentKey) {
  const index = SETUP_STEP_ORDER.indexOf(currentKey);
  if (index <= 0) return null;
  return SETUP_STEP_ORDER[index - 1];
}
