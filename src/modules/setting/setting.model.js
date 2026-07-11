import mongoose from 'mongoose';

const { Schema } = mongoose;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Configuración operativa de una Organization. Relación 1:1.
 * Los campos del setup wizard no tienen valores por defecto — el admin los define.
 */
const settingSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
      unique: true,
    },

    operatingHours: {
      openTime: {
        type: String,
        trim: true,
        match: [timePattern, 'Formato de hora inválido (HH:mm)'],
        default: null,
      },
      closeTime: {
        type: String,
        trim: true,
        match: [timePattern, 'Formato de hora inválido (HH:mm)'],
        default: null,
      },
      operatingDays: {
        type: [Number],
        default: [],
        validate: {
          validator: (days) => days.every((d) => d >= 0 && d <= 6),
          message: 'Los días de operación deben estar entre 0 y 6',
        },
      },
      /** Si true, ignora openTime/closeTime */
      operate24Hours: {
        type: Boolean,
        default: false,
      },
    },

    /** Capacidad máxima de vehículos simultáneos (opcional) */
    maxCapacity: {
      type: Number,
      min: [1, 'La capacidad mínima es 1'],
      default: null,
    },

    /** Permitir ingreso por encima de maxCapacity */
    allowOvercapacity: {
      type: Boolean,
      default: null,
    },

    /** Tiempo de gracia operativo general en minutos */
    graceMinutes: {
      type: Number,
      min: [0, 'El tiempo de gracia no puede ser negativo'],
      default: null,
    },

    timezone: {
      type: String,
      trim: true,
      maxlength: [80, 'La zona horaria no puede superar 80 caracteres'],
      default: null,
    },

    dateFormat: {
      type: String,
      trim: true,
      maxlength: [20, 'El formato de fecha no puede superar 20 caracteres'],
      default: null,
    },

    timeFormat: {
      type: String,
      enum: {
        values: ['12h', '24h'],
        message: 'Formato de hora inválido: {VALUE}',
      },
      default: null,
    },

    ticket: {
      showLogo: {
        type: Boolean,
        default: true,
      },
      showParkingName: {
        type: Boolean,
        default: true,
      },
      showAddress: {
        type: Boolean,
        default: true,
      },
      showPhone: {
        type: Boolean,
        default: true,
      },
      showTaxId: {
        type: Boolean,
        default: true,
      },
      header: {
        type: String,
        trim: true,
        maxlength: [200, 'El encabezado no puede superar 200 caracteres'],
        default: '',
      },
      footer: {
        type: String,
        trim: true,
        maxlength: [200, 'El pie de página no puede superar 200 caracteres'],
        default: '',
      },
      logoUrl: {
        type: String,
        trim: true,
        maxlength: [500, 'La URL del logo no puede superar 500 caracteres'],
        default: null,
      },
      welcomeMessage: {
        type: String,
        trim: true,
        maxlength: [300, 'El mensaje no puede superar 300 caracteres'],
        default: '',
      },
      farewellMessage: {
        type: String,
        trim: true,
        maxlength: [300, 'El mensaje no puede superar 300 caracteres'],
        default: '',
      },
      lostTicketPolicy: {
        type: String,
        trim: true,
        maxlength: [500, 'La política no puede superar 500 caracteres'],
        default: '',
      },
      paperSize: {
        type: String,
        enum: {
          values: ['58mm', '80mm', 'A4'],
          message: 'Tamaño de papel inválido: {VALUE}',
        },
        default: '80mm',
      },
      copies: {
        type: Number,
        min: [1, 'Debe imprimir al menos 1 copia'],
        max: [5, 'Máximo 5 copias'],
        default: 1,
      },
      /** Códigos preparados para integraciones futuras */
      enableQr: {
        type: Boolean,
        default: true,
      },
      enableBarcode: {
        type: Boolean,
        default: true,
      },
      preferredAdapter: {
        type: String,
        enum: ['browser', 'escpos', 'pdf', 'text', 'bluetooth', 'lan', 'usb'],
        default: 'browser',
      },
      businessName: {
        type: String,
        trim: true,
        maxlength: [120, 'El nombre no puede superar 120 caracteres'],
        default: '',
      },
      businessTaxId: {
        type: String,
        trim: true,
        maxlength: [40, 'El NIT no puede superar 40 caracteres'],
        default: '',
      },
      businessAddress: {
        type: String,
        trim: true,
        maxlength: [200, 'La dirección no puede superar 200 caracteres'],
        default: '',
      },
      businessCity: {
        type: String,
        trim: true,
        maxlength: [80, 'La ciudad no puede superar 80 caracteres'],
        default: '',
      },
      businessPhone: {
        type: String,
        trim: true,
        maxlength: [40, 'El teléfono no puede superar 40 caracteres'],
        default: '',
      },
      customMessages: {
        entry: {
          type: String,
          trim: true,
          maxlength: [300, 'El mensaje no puede superar 300 caracteres'],
          default: '',
        },
        exit: {
          type: String,
          trim: true,
          maxlength: [300, 'El mensaje no puede superar 300 caracteres'],
          default: '',
        },
        receipt: {
          type: String,
          trim: true,
          maxlength: [300, 'El mensaje no puede superar 300 caracteres'],
          default: '',
        },
        cash: {
          type: String,
          trim: true,
          maxlength: [300, 'El mensaje no puede superar 300 caracteres'],
          default: '',
        },
        membership: {
          type: String,
          trim: true,
          maxlength: [300, 'El mensaje no puede superar 300 caracteres'],
          default: '',
        },
      },
    },

    /** Políticas y terminales de caja (estructura preparada) */
    cash: {
      suggestedOpeningFloat: {
        type: Number,
        min: [0, 'El fondo inicial no puede ser negativo'],
        default: 0,
      },
      requireOpeningFloat: {
        type: Boolean,
        default: false,
      },
      requireClosingCount: {
        type: Boolean,
        default: true,
      },
      allowMultipleOpenSessions: {
        type: Boolean,
        default: false,
      },
      terminals: {
        type: [
          {
            name: {
              type: String,
              trim: true,
              maxlength: [80, 'El nombre no puede superar 80 caracteres'],
            },
            code: {
              type: String,
              trim: true,
              maxlength: [40, 'El código no puede superar 40 caracteres'],
            },
            status: {
              type: String,
              enum: ['active', 'inactive'],
              default: 'inactive',
            },
          },
        ],
        default: [],
      },
    },

    /** Planes de membresía configurables por organización */
    membershipConfig: {
      plans: {
        type: [
          {
            name: {
              type: String,
              required: true,
              trim: true,
              maxlength: [100, 'El nombre no puede superar 100 caracteres'],
            },
            durationDays: {
              type: Number,
              min: [1, 'La duración mínima es 1 día'],
              required: true,
            },
            price: {
              type: Number,
              min: [0, 'El precio no puede ser negativo'],
              default: 0,
            },
            benefits: {
              type: [String],
              default: [],
            },
            reminderDaysBefore: {
              type: Number,
              min: [0, 'Los días de recordatorio no pueden ser negativos'],
              default: 3,
            },
            isActive: {
              type: Boolean,
              default: true,
            },
          },
        ],
        default: [],
      },
    },

    /** Integraciones futuras — solo flags y config mínima */
    integrations: {
      whatsapp: {
        enabled: { type: Boolean, default: false },
        phoneNumber: { type: String, trim: true, default: null },
        notes: { type: String, trim: true, maxlength: 300, default: '' },
      },
      email: {
        enabled: { type: Boolean, default: false },
        fromAddress: { type: String, trim: true, lowercase: true, default: null },
      },
      qr: {
        enabled: { type: Boolean, default: false },
      },
      plateReaders: {
        enabled: { type: Boolean, default: false },
        provider: { type: String, trim: true, default: null },
      },
      barriers: {
        enabled: { type: Boolean, default: false },
        provider: { type: String, trim: true, default: null },
      },
      api: {
        enabled: { type: Boolean, default: false },
        webhookUrl: { type: String, trim: true, default: null },
      },
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [3, 'El código de moneda debe tener 3 caracteres'],
      default: null,
    },

    rounding: {
      mode: {
        type: String,
        enum: {
          values: ['none', 'up', 'down', 'nearest'],
          message: 'Modo de redondeo inválido: {VALUE}',
        },
        default: 'nearest',
      },
      unitMinutes: {
        type: Number,
        min: [1, 'La unidad de redondeo debe ser al menos 1'],
        default: 15,
      },
    },

    /** Métodos de pago habilitados por la organización */
    paymentMethods: {
      type: [
        {
          code: {
            type: String,
            required: true,
            trim: true,
            maxlength: [40, 'El código no puede superar 40 caracteres'],
          },
          label: {
            type: String,
            required: true,
            trim: true,
            maxlength: [80, 'La etiqueta no puede superar 80 caracteres'],
          },
          enabled: {
            type: Boolean,
            default: true,
          },
          displayOrder: {
            type: Number,
            default: 0,
          },
          isSystem: {
            type: Boolean,
            default: true,
          },
        },
      ],
      default: [],
    },

    notifications: {
      subscriptionExpiryAlert: {
        type: Boolean,
        default: true,
      },
      subscriptionExpiryDays: {
        type: Number,
        min: [1, 'Debe ser al menos 1 día'],
        default: 3,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [254, 'El correo no puede superar 254 caracteres'],
        default: null,
      },
    },

    /** Backups y recuperación */
    backups: {
      enabled: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: {
          values: ['disabled', 'daily', 'weekly', 'monthly'],
          message: 'Frecuencia de backup inválida: {VALUE}',
        },
        default: 'daily',
      },
      hour: { type: Number, min: 0, max: 23, default: 3 },
      minute: { type: Number, min: 0, max: 59, default: 0 },
      retentionDays: { type: Number, min: 1, max: 3650, default: 30 },
      retentionCount: { type: Number, min: 1, max: 500, default: 14 },
      storageProvider: {
        type: String,
        enum: {
          values: ['local', 's3', 'azure', 'gcs'],
          message: 'Proveedor de almacenamiento inválido: {VALUE}',
        },
        default: 'local',
      },
      includeAuditLogs: { type: Boolean, default: false },
      notes: { type: String, trim: true, maxlength: 500, default: '' },
    },
  },
  {
    timestamps: true,
    collection: 'settings',
  },
);

const Setting = mongoose.model('Setting', settingSchema);

export default Setting;
