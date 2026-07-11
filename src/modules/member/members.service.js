import Member from '#modules/member/member.model.js';
import Vehicle from '#modules/vehicle/vehicle.model.js';
import ParkingMembership from '#modules/parkingMembership/parkingMembership.model.js';
import MembershipPayment from '#modules/parkingMembership/membershipPayment.model.js';
import Ticket from '#modules/ticket/ticket.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { MEMBER_AUDIT } from '#modules/parkingMembership/constants.js';

export class MembersService {
  async list(organizationId, { search, status, page = 1, limit = 20 } = {}) {
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const match = { organizationId };
    if (status) match.status = status;
    if (search?.trim()) {
      const s = search.trim();
      match.$or = [
        { name: { $regex: s, $options: 'i' } },
        { documentNumber: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      Member.find(match).sort({ name: 1 }).skip(skip).limit(take).lean(),
      Member.countDocuments(match),
    ]);

    return {
      items,
      pagination: { page: Math.max(1, Number(page) || 1), limit: take, total, totalPages: Math.ceil(total / take) || 1 },
    };
  }

  async getById(organizationId, memberId) {
    const member = await Member.findOne({ _id: memberId, organizationId }).lean();
    if (!member) throw new ApiError(404, 'Miembro no encontrado');

    const [vehicles, memberships, payments, entries] = await Promise.all([
      Vehicle.find({ organizationId, memberId }).populate('vehicleCategoryId', 'name color').lean(),
      ParkingMembership.find({ organizationId, memberId })
        .populate('vehicleId', 'plate')
        .sort({ endDate: -1 })
        .lean(),
      MembershipPayment.find({ organizationId, memberId })
        .populate('receivedByUserId', 'firstName lastName')
        .populate('vehicleId', 'plate')
        .sort({ paidAt: -1 })
        .limit(50)
        .lean(),
      Ticket.find({ organizationId, memberId })
        .populate('vehicleId', 'plate')
        .sort({ entryAt: -1 })
        .limit(50)
        .select('status entryAt exitAt total coveredByMembership vehicleId')
        .lean(),
    ]);

    return { member, vehicles, memberships, payments, entries };
  }

  async create(organizationId, userId, payload, auditContext = {}) {
    if (payload.documentNumber) {
      const dup = await Member.findOne({
        organizationId,
        documentNumber: String(payload.documentNumber).trim(),
      }).lean();
      if (dup) throw new ApiError(409, 'Ya existe un miembro con ese documento');
    }

    const member = await Member.create({
      organizationId,
      memberType: payload.memberType || 'person',
      name: payload.name.trim(),
      documentType: payload.documentType || 'CC',
      documentNumber: payload.documentNumber?.trim() || undefined,
      email: payload.email?.trim() || undefined,
      phone: payload.phone?.trim() || undefined,
      address: payload.address?.trim() || undefined,
      status: payload.status === 'inactive' ? 'inactive' : 'active',
      notes: payload.notes?.trim() || undefined,
      tags: payload.tags || [],
    });

    await auditService.log({
      userId,
      organizationId,
      module: 'members',
      action: MEMBER_AUDIT.CREATED,
      description: `Miembro creado: ${member.name}`,
      entityType: 'member',
      entityId: member._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return member.toObject();
  }

  async update(organizationId, userId, memberId, payload, auditContext = {}) {
    const member = await Member.findOne({ _id: memberId, organizationId });
    if (!member) throw new ApiError(404, 'Miembro no encontrado');

    const fields = ['name', 'documentType', 'documentNumber', 'email', 'phone', 'address', 'notes', 'memberType', 'status'];
    for (const f of fields) {
      if (payload[f] !== undefined) {
        member[f] = typeof payload[f] === 'string' ? payload[f].trim() : payload[f];
      }
    }
    if (payload.tags) member.tags = payload.tags;

    await member.save();

    await auditService.log({
      userId,
      organizationId,
      module: 'members',
      action: MEMBER_AUDIT.UPDATED,
      description: `Miembro actualizado: ${member.name}`,
      entityType: 'member',
      entityId: member._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return member.toObject();
  }

  async linkVehicle(organizationId, userId, memberId, vehicleId, auditContext = {}) {
    const member = await Member.findOne({ _id: memberId, organizationId, status: 'active' }).lean();
    if (!member) throw new ApiError(404, 'Miembro no encontrado');

    const vehicle = await Vehicle.findOne({ _id: vehicleId, organizationId });
    if (!vehicle) throw new ApiError(404, 'Vehículo no encontrado');

    vehicle.memberId = memberId;
    await vehicle.save();

    await auditService.log({
      userId,
      organizationId,
      module: 'members',
      action: MEMBER_AUDIT.VEHICLE_LINKED,
      description: `Vehículo ${vehicle.plate} asociado a ${member.name}`,
      entityType: 'member',
      entityId: memberId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { vehicleId },
    });

    return vehicle.toObject();
  }

  async unlinkVehicle(organizationId, userId, memberId, vehicleId, auditContext = {}) {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, organizationId, memberId });
    if (!vehicle) throw new ApiError(404, 'Vehículo no asociado a este miembro');

    vehicle.memberId = null;
    await vehicle.save();

    await auditService.log({
      userId,
      organizationId,
      module: 'members',
      action: MEMBER_AUDIT.VEHICLE_UNLINKED,
      description: `Vehículo ${vehicle.plate} desasociado`,
      entityType: 'member',
      entityId: memberId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { vehicleId },
    });

    return vehicle.toObject();
  }
}

export const membersService = new MembersService();
