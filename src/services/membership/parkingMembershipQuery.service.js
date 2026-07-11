import ParkingMembership from '#modules/parkingMembership/parkingMembership.model.js';

/**
 * Consulta de membresías de estacionamiento vigentes.
 */
export class ParkingMembershipQueryService {
  async findActiveForVehicle(organizationId, vehicleId, at = new Date()) {
    return ParkingMembership.findOne({
      organizationId,
      vehicleId,
      status: 'active',
      startDate: { $lte: at },
      endDate: { $gte: at },
    }).lean();
  }
}

export const parkingMembershipQueryService = new ParkingMembershipQueryService();
