import { body, param } from 'express-validator';

export const siteIdParam = [param('siteId').isMongoId().withMessage('Sede inválida')];

export const createSiteValidation = [
  body('name').isString().trim().notEmpty().withMessage('El nombre es obligatorio').isLength({ max: 150 }),
  body('code').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body('city').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('status').optional().isIn(['active', 'inactive']),
];

export const updateSiteValidation = [
  body('name').optional().isString().trim().notEmpty().isLength({ max: 150 }),
  body('code').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body('city').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('status').optional().isIn(['active', 'inactive']),
];
