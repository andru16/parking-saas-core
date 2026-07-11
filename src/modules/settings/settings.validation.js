import { body, param } from 'express-validator';
import { SETTINGS_SECTION_ORDER } from '#services/settings-center/constants.js';

export const sectionKeyParamValidation = [
  param('sectionKey')
    .isIn(SETTINGS_SECTION_ORDER)
    .withMessage(`Sección inválida. Valores: ${SETTINGS_SECTION_ORDER.join(', ')}`),
];

export const generalValidation = [
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
];

export const operationalValidation = [
  body('operate24Hours').isBoolean(),
  body('allowOvercapacity').isBoolean(),
  body('graceMinutes').isInt({ min: 0 }),
  body('openTime').optional({ nullable: true }),
  body('closeTime').optional({ nullable: true }),
  body('maxCapacity').optional({ nullable: true }).isInt({ min: 1 }),
];

export const vehicleCategoriesValidation = [
  body('categories').isArray(),
  body('categories.*.name').trim().notEmpty(),
];

export const ratesValidation = [
  body('rates').isArray(),
  body('rates.*.name').trim().notEmpty(),
  body('rates.*.vehicleCategoryId').notEmpty(),
  body('rates.*.billingMode')
    .isIn(['per_minute', 'per_hour', 'hour_fraction', 'fixed', 'daily']),
  body('rates.*.value').isFloat({ min: 0 }),
];

export const paymentMethodsValidation = [
  body('methods').isArray(),
  body('methods.*.code').trim().notEmpty(),
  body('methods.*.label').trim().notEmpty(),
  body('methods.*.enabled').isBoolean(),
];

export const cashValidation = [
  body('cashPoints').isArray({ min: 1 }),
  body('cashPoints.*.name').trim().notEmpty(),
  body('policies').optional().isObject(),
  body('terminals').optional().isArray(),
];

export const printingValidation = [
  body('paperSize').optional().isIn(['58mm', '80mm', 'A4']),
  body('copies').optional().isInt({ min: 1, max: 5 }),
  body('showLogo').optional().isBoolean(),
  body('showParkingName').optional().isBoolean(),
  body('showAddress').optional().isBoolean(),
  body('showPhone').optional().isBoolean(),
  body('showTaxId').optional().isBoolean(),
  body('welcomeMessage').optional().isString(),
  body('farewellMessage').optional().isString(),
  body('lostTicketPolicy').optional().isString(),
  body('header').optional().isString(),
  body('footer').optional().isString(),
];

export const membershipsValidation = [
  body('plans').isArray(),
  body('plans.*.name').trim().notEmpty(),
  body('plans.*.durationDays').isInt({ min: 1 }),
];

export const usersValidation = [
  body('users').isArray(),
  body('users.*.id').notEmpty(),
];

export const integrationsValidation = [
  body('integrations').isObject(),
];

export const sectionValidationMap = {
  general: generalValidation,
  operational: operationalValidation,
  vehicle_categories: vehicleCategoriesValidation,
  rates: ratesValidation,
  payment_methods: paymentMethodsValidation,
  cash: cashValidation,
  printing: printingValidation,
  memberships: membershipsValidation,
  users: usersValidation,
  integrations: integrationsValidation,
};
