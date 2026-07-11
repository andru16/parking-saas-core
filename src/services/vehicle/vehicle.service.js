import Vehicle from '#modules/vehicle/vehicle.model.js';
import VehicleCategory from '#modules/vehicleCategory/vehicleCategory.model.js';
import { ApiError } from '#utils/ApiError.js';

/**
 * Operaciones de vehículos para el Centro de Operaciones.
 */
export class VehicleService {
  normalizePlate(plate) {
    return plate?.trim().toUpperCase() ?? '';
  }

  async findByPlate(organizationId, plate) {
    const normalized = this.normalizePlate(plate);

    if (!normalized) {
      return null;
    }

    return Vehicle.findOne({
      organizationId,
      plate: normalized,
      status: 'active',
    })
      .populate('vehicleCategoryId', 'name color icon requirements')
      .lean();
  }

  async assertCategory(organizationId, vehicleCategoryId) {
    const category = await VehicleCategory.findOne({
      _id: vehicleCategoryId,
      organizationId,
      isDeleted: false,
      isActive: true,
    }).lean();

    if (!category) {
      throw new ApiError(400, 'Categoría de vehículo inválida');
    }

    return category;
  }

  /**
   * Registro rápido de vehículo ocasional (sin Member).
   */
  async quickRegister(organizationId, { plate, vehicleCategoryId, notes = null }) {
    const category = await this.assertCategory(organizationId, vehicleCategoryId);
    const normalizedPlate = this.normalizePlate(plate);

    if (category.requirements?.requiresPlate && !normalizedPlate) {
      throw new ApiError(400, 'La placa es obligatoria para esta categoría');
    }

    if (normalizedPlate) {
      const existing = await this.findByPlate(organizationId, normalizedPlate);
      if (existing) {
        throw new ApiError(409, 'Ya existe un vehículo con esta placa');
      }
    }

    const [vehicle] = await Vehicle.create([
      {
        organizationId,
        memberId: null,
        vehicleCategoryId,
        plate: normalizedPlate || null,
        notes,
        status: 'active',
      },
    ]);

    return Vehicle.findById(vehicle._id)
      .populate('vehicleCategoryId', 'name color icon requirements')
      .lean();
  }

  /**
   * Busca por placa o registra el vehículo y lo asocia al miembro.
   */
  async findOrCreateForMember(
    organizationId,
    { plate, vehicleCategoryId, memberId, notes = null },
  ) {
    const normalizedPlate = this.normalizePlate(plate);
    if (!normalizedPlate) {
      throw new ApiError(400, 'La placa es obligatoria');
    }

    const vehicle = await Vehicle.findOne({
      organizationId,
      plate: normalizedPlate,
    });

    if (vehicle) {
      if (memberId && String(vehicle.memberId ?? '') !== String(memberId)) {
        vehicle.memberId = memberId;
        await vehicle.save();
      }
      return Vehicle.findById(vehicle._id)
        .populate('vehicleCategoryId', 'name color icon requirements')
        .lean();
    }

    if (!vehicleCategoryId) {
      throw new ApiError(400, 'Seleccione la categoría del vehículo');
    }

    await this.assertCategory(organizationId, vehicleCategoryId);

    const [created] = await Vehicle.create([
      {
        organizationId,
        memberId: memberId || null,
        vehicleCategoryId,
        plate: normalizedPlate,
        notes,
        status: 'active',
      },
    ]);

    return Vehicle.findById(created._id)
      .populate('vehicleCategoryId', 'name color icon requirements')
      .lean();
  }
}

export const vehicleService = new VehicleService();
