import { body, param, query } from 'express-validator';

export const loginValidation = [
  body('email').trim().isEmail().withMessage('Correo inválido').normalizeEmail(),
  body('password').notEmpty().withMessage('La contraseña es obligatoria'),
];

export const orgIdParam = [
  param('organizationId').isMongoId().withMessage('ID de organización inválido'),
];

export const listOrgsValidation = [
  query('search').optional().trim().isLength({ max: 120 }),
  query('status')
    .optional()
    .isIn(['active', 'trial', 'suspended', 'pending_verification'])
    .withMessage('Estado inválido'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const statusActionValidation = [
  ...orgIdParam,
  body('action')
    .isIn(['activate', 'suspend', 'reactivate', 'trial'])
    .withMessage('Acción inválida'),
];

export const extendTrialValidation = [
  ...orgIdParam,
  body('days').optional().isInt({ min: 1, max: 90 }).toInt(),
];

export const changePlanValidation = [
  ...orgIdParam,
  body('planId').isMongoId().withMessage('Plan inválido'),
  body('billingCycle')
    .optional()
    .isIn(['trial', 'monthly', 'quarterly', 'semiannual', 'annual']),
  body('changeMode').optional().isIn(['immediate', 'scheduled']),
  body('scheduledAt').optional().isISO8601(),
  body('notes').optional().trim().isLength({ max: 1000 }),
];

export const planIdParam = [param('planId').isMongoId().withMessage('ID de plan inválido')];

export const createPlanValidation = [
  body('name').trim().notEmpty().isLength({ max: 80 }),
  body('code')
    .trim()
    .notEmpty()
    .isLength({ max: 40 })
    .matches(/^[a-z0-9_-]+$/i)
    .withMessage('Código inválido'),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('isActive').optional().isBoolean(),
  body('isTrialPlan').optional().isBoolean(),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }),
  body('sortOrder').optional().isInt(),
  body('color').optional().trim().isLength({ max: 30 }),
  body('defaultDurationDays').optional().isInt({ min: 1 }),
  body('pricing').optional().isObject(),
  body('limits').optional().isObject(),
  body('features').optional().isObject(),
  body('icon').optional().isObject(),
];

export const updatePlanValidation = [...createPlanValidation];

export const setPlanActiveValidation = [
  ...planIdParam,
  body('isActive').isBoolean().withMessage('isActive es obligatorio'),
];

export const impersonateValidation = [
  ...orgIdParam,
  body('reason').optional().trim().isLength({ max: 500 }),
];

export const subscriptionAlertsValidation = [
  query('filter')
    .optional()
    .isIn([
      'trials_expiring',
      'subscriptions_expiring',
      'subscriptions_expired',
      'suspended',
      'grace_period',
    ])
    .withMessage('Filtro inválido'),
  query('search').optional().trim().isLength({ max: 120 }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
