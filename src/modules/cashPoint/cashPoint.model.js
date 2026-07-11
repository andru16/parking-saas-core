import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Punto de caja físico o virtual de una organización.
 * Las sesiones de caja (CashRegister) se asociarán a un CashPoint en el futuro.
 */
const cashPointSchema = new Schema(
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
      maxlength: [100, 'El nombre no puede superar 100 caracteres'],
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

    displayOrder: {
      type: Number,
      min: [0, 'El orden no puede ser negativo'],
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'cashPoints',
  },
);

cashPointSchema.index({ organizationId: 1, status: 1 });
cashPointSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

const CashPoint = mongoose.model('CashPoint', cashPointSchema);

export default CashPoint;
