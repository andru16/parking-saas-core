import mongoose from 'mongoose';
import { DEFAULT_PLATFORM_SETTINGS, PLATFORM_SETTINGS_KEY } from './constants.js';

const { Schema } = mongoose;

/**
 * Configuración global de plataforma (singleton lógico).
 * Solo Super Admin escribe; lectura vía SettingsService + cache.
 */
const platformSettingsSchema = new Schema(
  {
    key: {
      type: String,
      default: PLATFORM_SETTINGS_KEY,
      unique: true,
      immutable: true,
    },

    branding: {
      platformName: {
        type: String,
        trim: true,
        default: DEFAULT_PLATFORM_SETTINGS.branding.platformName,
      },
      logoUrl: { type: String, trim: true, default: null },
      faviconUrl: { type: String, trim: true, default: null },
      primaryColor: {
        type: String,
        trim: true,
        default: DEFAULT_PLATFORM_SETTINGS.branding.primaryColor,
      },
      secondaryColor: {
        type: String,
        trim: true,
        default: DEFAULT_PLATFORM_SETTINGS.branding.secondaryColor,
      },
    },

    maintenance: {
      enabled: { type: Boolean, default: false },
      message: {
        type: String,
        trim: true,
        maxlength: 500,
        default: DEFAULT_PLATFORM_SETTINGS.maintenance.message,
      },
    },

    security: {
      maxSessionMinutes: { type: Number, min: 5, max: 10080, default: 480 },
      maxLoginAttempts: { type: Number, min: 3, max: 100, default: 10 },
      loginWindowMinutes: { type: Number, min: 1, max: 1440, default: 15 },
      passwordMinLength: { type: Number, min: 6, max: 128, default: 8 },
      passwordRequireUppercase: { type: Boolean, default: true },
      passwordRequireNumber: { type: Boolean, default: true },
      passwordRequireSpecial: { type: Boolean, default: false },
    },

    saas: {
      defaultTrialDays: { type: Number, min: 1, max: 365, default: 15 },
      trialPremiumDays: { type: Number, min: 1, max: 90, default: 3 },
      gracePeriodDays: { type: Number, min: 0, max: 90, default: 5 },
    },

    support: {
      email: { type: String, trim: true, default: 'soporte.parkingsaas@gmail.com' },
      whatsapp: { type: String, trim: true, default: '' },
      schedule: { type: String, trim: true, default: 'Lun–Vie 8:00–18:00 (COT)' },
    },

    defaults: {
      timezone: { type: String, trim: true, default: 'America/Bogota' },
      language: { type: String, trim: true, default: 'es' },
      currency: { type: String, trim: true, uppercase: true, default: 'COP' },
    },

    i18n: {
      enabled: { type: Boolean, default: false },
      locales: { type: [String], default: ['es'] },
    },
    multiCurrency: { enabled: { type: Boolean, default: false } },
    multiSite: { enabled: { type: Boolean, default: false } },
    dynamicVariables: { enabled: { type: Boolean, default: false } },
  },
  {
    timestamps: true,
    collection: 'platformSettings',
  },
);

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

export default PlatformSettings;
