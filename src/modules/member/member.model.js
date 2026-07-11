import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Miembro del parqueadero — persona o empresa con relación permanente.
 * Solo los miembros requieren datos personales (mensualidades, convenios, VIP, empresas).
 * Los vehículos ocasionales NO crean un Member.
 */
const memberSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    /** Tipo de miembro */
    memberType: {
      type: String,
      enum: {
        values: ['person', 'company'],
        message: 'Tipo de miembro inválido: {VALUE}',
      },
      default: 'person',
      required: true,
    },

    /** Nombre completo o razón social */
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: [150, 'El nombre no puede superar 150 caracteres'],
    },

    documentType: {
      type: String,
      trim: true,
      uppercase: true,
      enum: {
        values: ['CC', 'CE', 'NIT', 'PASSPORT', 'OTHER'],
        message: 'Tipo de documento inválido: {VALUE}',
      },
      default: 'CC',
    },

    documentNumber: {
      type: String,
      trim: true,
      maxlength: [30, 'El documento no puede superar 30 caracteres'],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [254, 'El correo no puede superar 254 caracteres'],
      match: [/^\S+@\S+\.\S+$/, 'Formato de correo inválido'],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'El teléfono no puede superar 20 caracteres'],
    },

    address: {
      type: String,
      trim: true,
      maxlength: [300, 'La dirección no puede superar 300 caracteres'],
    },

    /**
     * Clasificación operativa del miembro (mensualidad, convenio, VIP, etc.)
     * Permite filtrar y reportar sin acoplar al modelo de membresía activa.
     */
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags) => tags.every((t) => typeof t === 'string' && t.length <= 50),
        message: 'Cada etiqueta debe ser texto de máximo 50 caracteres',
      },
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: 'Estado inválido: {VALUE}',
      },
      default: 'active',
      required: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Las notas no pueden superar 500 caracteres'],
    },
  },
  {
    timestamps: true,
    collection: 'members',
  },
);

memberSchema.index({ organizationId: 1, status: 1 });
memberSchema.index({ organizationId: 1, name: 1 });
memberSchema.index(
  { organizationId: 1, documentNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { documentNumber: { $type: 'string', $ne: '' } },
    name: 'unique_document_per_org',
  },
);

const Member = mongoose.model('Member', memberSchema);

export default Member;
