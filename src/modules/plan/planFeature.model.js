import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Catálogo de features del SaaS (configurable en BD).
 * Los planes referencian estas keys; no se queman reglas en componentes.
 */
const planFeatureSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [80, 'La key no puede superar 80 caracteres'],
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, 'El label no puede superar 120 caracteres'],
    },
    category: {
      type: String,
      trim: true,
      maxlength: [80, 'La categoría no puede superar 80 caracteres'],
      default: 'general',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'La descripción no puede superar 500 caracteres'],
      default: '',
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'planFeatures',
  },
);

planFeatureSchema.index({ category: 1, sortOrder: 1 });

const PlanFeature = mongoose.model('PlanFeature', planFeatureSchema);

export default PlanFeature;
