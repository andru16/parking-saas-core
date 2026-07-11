import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Tarifa de cobro configurable por Organization.
 * Base del motor de tarifas; soporta múltiples modalidades y contextos.
 */
const rateSchema = new Schema(
  {
    /** Parqueadero propietario de la tarifa */
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    /** Nombre descriptivo de la tarifa */
    name: {
      type: String,
      required: [true, 'El nombre de la tarifa es obligatorio'],
      trim: true,
      maxlength: [100, 'El nombre no puede superar 100 caracteres'],
    },

    /** Categoría de vehículo a la que aplica la tarifa */
    vehicleCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'VehicleCategory',
      required: [true, 'La categoría de vehículo es obligatoria'],
    },

    /** @deprecated Usar vehicleCategoryId — se mantiene vacío en nuevas tarifas */
    vehicleTypes: {
      type: [String],
      default: [],
    },

    /** Contexto de aplicación para resolución de prioridad */
    contextType: {
      type: String,
      enum: {
        values: ['normal', 'night', 'holiday', 'special'],
        message: 'Contexto inválido: {VALUE}',
      },
      default: 'normal',
      required: true,
    },

    /** Prioridad relativa (mayor número = mayor prioridad en tarifas especiales) */
    priority: {
      type: Number,
      default: 0,
      min: [0, 'La prioridad no puede ser negativa'],
    },

    /** Modalidad de cobro */
    billingMode: {
      type: String,
      enum: {
        values: ['per_minute', 'per_hour', 'hour_fraction', 'fixed', 'daily'],
        message: 'Modalidad de cobro inválida: {VALUE}',
      },
      required: [true, 'La modalidad de cobro es obligatoria'],
    },

    /** Valor base de la tarifa */
    value: {
      type: Number,
      required: [true, 'El valor es obligatorio'],
      min: [0, 'El valor no puede ser negativo'],
    },

    /** Tiempo base incluido en minutos (primera fracción/hora) */
    baseTimeMinutes: {
      type: Number,
      min: [0, 'El tiempo base no puede ser negativo'],
      default: 0,
    },

    /** Fracción mínima de cobro en minutos */
    minFractionMinutes: {
      type: Number,
      min: [1, 'La fracción mínima debe ser al menos 1 minuto'],
      default: null,
    },

    /** Tiempo de gracia en minutos (sin cobro al inicio) */
    graceMinutes: {
      type: Number,
      min: [0, 'El tiempo de gracia no puede ser negativo'],
      default: 0,
    },

    /** Cobro máximo permitido por día */
    maxDailyCharge: {
      type: Number,
      min: [0, 'El cobro máximo diario no puede ser negativo'],
      default: null,
    },

    /** Precio por fracción adicional (modalidad hour_fraction) */
    fractionPrice: {
      type: Number,
      min: [0, 'El precio por fracción no puede ser negativo'],
      default: null,
    },

    /** Hora de inicio de ventana horaria (HH:mm, para contexto night/special) */
    windowStart: {
      type: String,
      trim: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:mm)'],
      default: null,
    },

    /** Hora de fin de ventana horaria (HH:mm) */
    windowEnd: {
      type: String,
      trim: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:mm)'],
      default: null,
    },

    /** Inicio de vigencia de la tarifa */
    validFrom: {
      type: Date,
      default: null,
    },

    /** Fin de vigencia de la tarifa */
    validTo: {
      type: Date,
      default: null,
    },

    /** true = tarifa por defecto cuando no hay otra aplicable */
    isDefault: {
      type: Boolean,
      default: false,
    },

    /** Estado de la tarifa */
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: 'Estado inválido: {VALUE}',
      },
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'rates',
  },
);

rateSchema.index({ organizationId: 1, status: 1, contextType: 1 });
rateSchema.index({ organizationId: 1, vehicleCategoryId: 1, status: 1 });
rateSchema.index({ organizationId: 1, priority: -1 });
rateSchema.index({ organizationId: 1, isDefault: 1 });

const Rate = mongoose.model('Rate', rateSchema);

export default Rate;
