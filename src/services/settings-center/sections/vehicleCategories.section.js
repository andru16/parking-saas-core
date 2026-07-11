import Rate from '#modules/rate/rate.model.js';
import Ticket from '#modules/ticket/ticket.model.js';
import Vehicle from '#modules/vehicle/vehicle.model.js';
import VehicleCategory from '#modules/vehicleCategory/vehicleCategory.model.js';
import { ApiError } from '#utils/ApiError.js';
import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';

export class VehicleCategoriesSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.VEHICLE_CATEGORIES, {
      label: 'Categorías de vehículos',
      description: 'Tipos de vehículo operativos del parqueadero.',
    });
  }

  async get(context) {
    const categories = await VehicleCategory.find({
      organizationId: context.organizationId,
      isDeleted: false,
    })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    const withUsage = await Promise.all(
      categories.map(async (category) => {
        const inUse = await this.#isInUse(context.organizationId, category._id);
        return { ...this.#toResponse(category), inUse };
      }),
    );

    return { categories: withUsage };
  }

  async save(context, payload) {
    if (!Array.isArray(payload.categories)) {
      throw new ApiError(400, 'Se requiere un arreglo de categorías');
    }

    for (const item of payload.categories) {
      if (!item.name?.trim()) {
        throw new ApiError(400, 'Cada categoría debe tener un nombre');
      }
    }

    const keptIds = new Set();

    for (const [index, item] of payload.categories.entries()) {
      const data = {
        name: item.name.trim(),
        description: item.description?.trim() ?? '',
        icon: item.icon?.trim() || 'vehicle',
        color: item.color || '#3B82F6',
        displayOrder: item.displayOrder ?? index,
        isActive: item.isActive ?? true,
        requirements: {
          requiresPlate: item.requirements?.requiresPlate ?? true,
          requiresOwner: item.requirements?.requiresOwner ?? false,
          requiresPhoto: item.requirements?.requiresPhoto ?? false,
          requiresNotes: item.requirements?.requiresNotes ?? false,
        },
      };

      if (item.id) {
        const updated = await VehicleCategory.findOneAndUpdate(
          { _id: item.id, organizationId: context.organizationId, isDeleted: false },
          { $set: data },
          { new: true },
        );

        if (updated) {
          keptIds.add(updated._id.toString());
          continue;
        }
      }

      const existingByName = await VehicleCategory.findOne({
        organizationId: context.organizationId,
        name: data.name,
        isDeleted: false,
      });

      if (existingByName) {
        existingByName.set(data);
        await existingByName.save();
        keptIds.add(existingByName._id.toString());
      } else {
        const created = await VehicleCategory.create({
          organizationId: context.organizationId,
          ...data,
        });
        keptIds.add(created._id.toString());
      }
    }

    const existing = await VehicleCategory.find({
      organizationId: context.organizationId,
      isDeleted: false,
    });

    for (const category of existing) {
      if (keptIds.has(category._id.toString())) continue;

      const inUse = await this.#isInUse(context.organizationId, category._id);
      if (inUse) {
        throw new ApiError(
          409,
          `No se puede eliminar la categoría "${category.name}" porque está en uso. Desactívela en su lugar.`,
        );
      }

      category.isDeleted = true;
      category.isActive = false;
      await category.save();
    }

    return this.get(context);
  }

  async #isInUse(organizationId, categoryId) {
    const [tickets, vehicles, rates] = await Promise.all([
      Ticket.exists({ organizationId, vehicleCategoryId: categoryId }),
      Vehicle.exists({ organizationId, vehicleCategoryId: categoryId }),
      Rate.exists({ organizationId, vehicleCategoryId: categoryId }),
    ]);

    return Boolean(tickets || vehicles || rates);
  }

  #toResponse(category) {
    return {
      id: category._id?.toString?.() ?? category._id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      requirements: category.requirements,
    };
  }
}
