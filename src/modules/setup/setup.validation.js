import { body, param } from 'express-validator';
import { SETUP_STEP_ORDER } from '#services/setup/constants.js';

const savableSteps = SETUP_STEP_ORDER.filter((s) => s !== 'summary');

export const stepKeyParamValidation = [
  param('stepKey')
    .isIn(savableSteps)
    .withMessage(`Paso inválido. Valores permitidos: ${savableSteps.join(', ')}`),
];

export const generalInfoValidation = [
  body('commercialName').trim().notEmpty().withMessage('El nombre comercial es obligatorio'),
  body('address').trim().notEmpty().withMessage('La dirección es obligatoria'),
  body('city').trim().notEmpty().withMessage('La ciudad es obligatoria'),
  body('country').trim().notEmpty().withMessage('El país es obligatorio'),
  body('phone').trim().notEmpty().withMessage('El teléfono es obligatorio'),
  body('email').trim().isEmail().withMessage('Correo inválido').normalizeEmail(),
  body('timezone').trim().notEmpty().withMessage('La zona horaria es obligatoria'),
  body('currency').trim().isLength({ min: 3, max: 3 }).withMessage('Moneda ISO de 3 caracteres'),
  body('dateFormat').trim().notEmpty().withMessage('El formato de fecha es obligatorio'),
  body('timeFormat').isIn(['12h', '24h']).withMessage('Formato de hora inválido'),
  body('legalName').optional({ values: 'null' }).trim(),
  body('taxId').optional({ values: 'null' }).trim(),
  body('stateOrDepartment').optional({ values: 'null' }).trim(),
];

export const operationalValidation = [
  body('operate24Hours').isBoolean().withMessage('operate24Hours debe ser booleano'),
  body('allowOvercapacity').isBoolean().withMessage('allowOvercapacity debe ser booleano'),
  body('graceMinutes').isInt({ min: 0 }).withMessage('El tiempo de gracia debe ser >= 0'),
  body('openTime').custom((value, { req }) => {
    if (!req.body.operate24Hours && !value) {
      throw new Error('Hora de apertura obligatoria (HH:mm)');
    }
    if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new Error('Hora de apertura inválida (HH:mm)');
    }
    return true;
  }),
  body('closeTime').custom((value, { req }) => {
    if (!req.body.operate24Hours && !value) {
      throw new Error('Hora de cierre obligatoria (HH:mm)');
    }
    if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new Error('Hora de cierre inválida (HH:mm)');
    }
    return true;
  }),
  body('maxCapacity').optional({ nullable: true }).isInt({ min: 1 }),
];

export const vehicleCategoriesValidation = [
  body('categories').isArray({ min: 0 }).withMessage('categories debe ser un arreglo'),
  body('categories.*.name')
    .trim()
    .notEmpty()
    .withMessage('El nombre de la categoría es obligatorio'),
  body('categories.*.color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color hexadecimal inválido'),
  body('categories.*.isActive').optional().isBoolean(),
];

export const ratesValidation = [
  body('rates').isArray({ min: 0 }).withMessage('rates debe ser un arreglo'),
  body('rates.*.name').trim().notEmpty().withMessage('El nombre de la tarifa es obligatorio'),
  body('rates.*.vehicleCategoryId').notEmpty().withMessage('La categoría es obligatoria'),
  body('rates.*.billingMode')
    .isIn(['per_minute', 'per_hour', 'hour_fraction', 'fixed', 'daily'])
    .withMessage('Modalidad de cobro inválida'),
  body('rates.*.value').isFloat({ min: 0 }).withMessage('El valor debe ser >= 0'),
  body('rates.*.status').optional().isIn(['active', 'inactive']),
];

export const cashPointValidation = [
  body('cashPoints').isArray({ min: 1 }).withMessage('Debe incluir al menos una caja'),
  body('cashPoints.*.name').trim().notEmpty().withMessage('El nombre de la caja es obligatorio'),
  body('cashPoints.*.status').optional().isIn(['active', 'inactive']),
];

export const stepValidationMap = {
  general_info: generalInfoValidation,
  operational: operationalValidation,
  vehicle_categories: vehicleCategoriesValidation,
  rates: ratesValidation,
  cash_point: cashPointValidation,
};
