import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Sede / ubicación de una organización.
 * Planes sin multi_site operan con una sola sede primaria.
 */
const siteSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'La organización es obligatoria'],
    },

    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: [150, 'El nombre no puede superar 150 caracteres'],
    },

    code: {
      type: String,
      trim: true,
      maxlength: [30, 'El código no puede superar 30 caracteres'],
      default: null,
    },

    address: {
      type: String,
      trim: true,
      maxlength: [300, 'La dirección no puede superar 300 caracteres'],
      default: null,
    },

    city: {
      type: String,
      trim: true,
      maxlength: [100, 'La ciudad no puede superar 100 caracteres'],
      default: null,
    },

    isPrimary: {
      type: Boolean,
      default: false,
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
  },
  {
    timestamps: true,
    collection: 'sites',
  },
);

siteSchema.index({ organizationId: 1, status: 1 });
siteSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
siteSchema.index(
  { organizationId: 1, isPrimary: 1 },
  { unique: true, partialFilterExpression: { isPrimary: true } },
);

const Site = mongoose.model('Site', siteSchema);

export default Site;
