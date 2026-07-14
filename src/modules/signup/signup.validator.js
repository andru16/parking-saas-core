import { body } from 'express-validator';
import User from '#modules/user/user.model.js';
import Organization from '#modules/organization/organization.model.js';
import {
  assertBotGuard,
  assertBusinessName,
  assertEmail,
  assertPersonName,
  assertPhone,
  assertPlaceName,
  BOT_REJECT_MESSAGE,
  EMAIL_MESSAGE,
  PHONE_MESSAGE,
} from '#utils/fieldValidation.js';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const signupValidation = [
  body().custom((_, { req }) =>
    assertBotGuard({
      website: req.body?.website,
      formStartedAt: req.body?.formStartedAt,
    }),
  ),

  body('website').optional({ values: 'falsy' }).isString().isLength({ max: 0 }).withMessage(BOT_REJECT_MESSAGE),

  body('formStartedAt')
    .notEmpty()
    .withMessage(BOT_REJECT_MESSAGE)
    .isNumeric()
    .withMessage(BOT_REJECT_MESSAGE),

  body('admin.firstName')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ max: 80 })
    .withMessage('El nombre no puede superar 80 caracteres')
    .custom((value) => assertPersonName(value, 'El nombre')),

  body('admin.lastName')
    .trim()
    .notEmpty()
    .withMessage('Los apellidos son obligatorios')
    .isLength({ max: 80 })
    .withMessage('Los apellidos no pueden superar 80 caracteres')
    .custom((value) => assertPersonName(value, 'Los apellidos')),

  body('admin.email')
    .trim()
    .notEmpty()
    .withMessage('El correo electrónico es obligatorio')
    .custom((value) => assertEmail(value))
    .withMessage(EMAIL_MESSAGE)
    .normalizeEmail()
    .custom(async (email) => {
      const existing = await User.findOne({ email }).select('_id').lean();
      if (existing) {
        throw new Error('El correo electrónico ya está registrado');
      }
      return true;
    }),

  body('admin.password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(PASSWORD_REGEX)
    .withMessage('La contraseña debe incluir mayúsculas, minúsculas y números'),

  body('admin.confirmPassword')
    .notEmpty()
    .withMessage('La confirmación de contraseña es obligatoria')
    .custom((value, { req }) => {
      if (value !== req.body.admin?.password) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),

  body('organization.name')
    .trim()
    .notEmpty()
    .withMessage('El nombre del parqueadero es obligatorio')
    .isLength({ max: 150 })
    .withMessage('El nombre no puede superar 150 caracteres')
    .custom((value) => assertBusinessName(value, 'El nombre del parqueadero'))
    .custom(async (name) => {
      const existing = await Organization.findOne({ name: name.trim() })
        .collation({ locale: 'en', strength: 2 })
        .select('_id')
        .lean();

      if (existing) {
        throw new Error('Ya existe un parqueadero con este nombre');
      }
      return true;
    }),

  body('organization.city')
    .trim()
    .notEmpty()
    .withMessage('La ciudad es obligatoria')
    .isLength({ max: 100 })
    .withMessage('La ciudad no puede superar 100 caracteres')
    .custom((value) => assertPlaceName(value, 'La ciudad')),

  body('organization.country')
    .trim()
    .notEmpty()
    .withMessage('El país es obligatorio')
    .isLength({ max: 100 })
    .withMessage('El país no puede superar 100 caracteres')
    .custom((value) => assertPlaceName(value, 'El país')),

  body('organization.phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 })
    .withMessage('El teléfono no puede superar 20 caracteres')
    .custom((value) => assertPhone(value))
    .withMessage(PHONE_MESSAGE),
];

export const signupMetadataValidation = [
  body('metadata.channel').optional().isString(),
  body('metadata.referralCode').optional().isString(),
  body('metadata.promoCode').optional().isString(),
  body('metadata.invitationId').optional().isString(),
];
