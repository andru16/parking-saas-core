import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Parqueadero registrado en la plataforma SaaS.
 * Entidad raíz del multi-tenancy; no incluye organizationId.
 */
const organizationSchema = new Schema(
  {
    /** Nombre comercial del parqueadero */
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: [150, 'El nombre no puede superar 150 caracteres'],
    },

    /** Razón social (opcional) */
    legalName: {
      type: String,
      trim: true,
      maxlength: [200, 'La razón social no puede superar 200 caracteres'],
      default: null,
    },

    /** Correo de contacto principal */
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [254, 'El correo no puede superar 254 caracteres'],
      match: [/^\S+@\S+\.\S+$/, 'Formato de correo inválido'],
    },

    /** Teléfono de contacto */
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'El teléfono no puede superar 20 caracteres'],
    },

    /** Ciudad donde opera el parqueadero */
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'La ciudad no puede superar 100 caracteres'],
    },

    /** Departamento o estado */
    stateOrDepartment: {
      type: String,
      trim: true,
      maxlength: [100, 'El departamento no puede superar 100 caracteres'],
      default: null,
    },

    /** País donde opera el parqueadero */
    country: {
      type: String,
      trim: true,
      maxlength: [100, 'El país no puede superar 100 caracteres'],
    },

    /** Identificador fiscal o NIT */
    taxId: {
      type: String,
      trim: true,
      maxlength: [30, 'El NIT no puede superar 30 caracteres'],
    },

    /** Dirección física del parqueadero */
    address: {
      type: String,
      trim: true,
      maxlength: [300, 'La dirección no puede superar 300 caracteres'],
    },

    /** Sitio web (opcional) */
    website: {
      type: String,
      trim: true,
      maxlength: [250, 'El sitio web no puede superar 250 caracteres'],
      default: null,
    },

    /** Estado operativo en la plataforma */
    status: {
      type: String,
      enum: {
        values: ['active', 'suspended', 'trial', 'pending_verification'],
        message: 'Estado inválido: {VALUE}',
      },
      default: 'trial',
      required: true,
    },

    /** Indica si completó la configuración inicial */
    isSetupComplete: {
      type: Boolean,
      default: false,
    },

    /** Progreso del asistente de configuración inicial */
    setupProgress: {
      currentStep: {
        type: String,
        default: 'general_info',
        trim: true,
      },
      completedSteps: {
        type: [String],
        default: [],
      },
      lastSavedAt: {
        type: Date,
        default: null,
      },
    },

    /** Logo — estructura preparada; carga de archivo pendiente */
    logo: {
      url: { type: String, trim: true, maxlength: 500, default: null },
      path: { type: String, trim: true, maxlength: 500, default: null },
      uploadedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
    collection: 'organizations',
  },
);

organizationSchema.index({ status: 1 });
organizationSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
organizationSchema.index({ createdAt: -1 });

const Organization = mongoose.model('Organization', organizationSchema);

export default Organization;
