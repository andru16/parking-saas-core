import ParkingMembership from '#modules/parkingMembership/parkingMembership.model.js';
import MembershipPayment from '#modules/parkingMembership/membershipPayment.model.js';
import Member from '#modules/member/member.model.js';
import Vehicle from '#modules/vehicle/vehicle.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { vehicleService } from '#services/vehicle/vehicle.service.js';
import { membersService } from '#modules/member/members.service.js';
import {
  MEMBERSHIP_AUDIT,
  MEMBERSHIP_EXPIRING_DAYS,
  MEMBERSHIP_STATUSES,
  resolveMembershipDisplayStatus,
} from './constants.js';

const POPULATE = [
  { path: 'memberId', select: 'name documentNumber phone email status' },
  { path: 'vehicleId', select: 'plate vehicleCategoryId status', populate: { path: 'vehicleCategoryId', select: 'name color' } },
];

export class ParkingMembershipsService {
  #format(doc) {
    const plain = doc.toObject?.() ?? doc;
    return {
      ...plain,
      displayStatus: resolveMembershipDisplayStatus(plain),
    };
  }

  async list(organizationId, { status, search, page = 1, limit = 20 } = {}) {
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const match = { organizationId };
    const now = new Date();

    if (status === 'expiring') {
      match.status = MEMBERSHIP_STATUSES.ACTIVE;
      match.endDate = {
        $gte: now,
        $lte: new Date(now.getTime() + MEMBERSHIP_EXPIRING_DAYS * 86400000),
      };
    } else if (status === 'expired') {
      match.$or = [
        { status: MEMBERSHIP_STATUSES.EXPIRED },
        { status: MEMBERSHIP_STATUSES.ACTIVE, endDate: { $lt: now } },
      ];
    } else if (status) {
      match.status = status;
    }

    let items = await ParkingMembership.find(match)
      .populate(POPULATE)
      .sort({ endDate: 1 })
      .skip(skip)
      .limit(take)
      .lean();

    if (search?.trim()) {
      const s = search.trim().toLowerCase();
      items = items.filter((m) => {
        const plate = m.vehicleId?.plate?.toLowerCase() ?? '';
        const name = m.memberId?.name?.toLowerCase() ?? '';
        return plate.includes(s) || name.includes(s) || m.name?.toLowerCase().includes(s);
      });
    }

    const total = await ParkingMembership.countDocuments(match);

    return {
      items: items.map((i) => this.#format(i)),
      pagination: {
        page: Math.max(1, Number(page) || 1),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  async getById(organizationId, id) {
    const doc = await ParkingMembership.findOne({ _id: id, organizationId })
      .populate(POPULATE)
      .lean();
    if (!doc) throw new ApiError(404, 'Membresía no encontrada');

    const payments = await MembershipPayment.find({
      organizationId,
      parkingMembershipId: id,
    })
      .populate('receivedByUserId', 'firstName lastName')
      .sort({ paidAt: -1 })
      .lean();

    return { membership: this.#format(doc), payments };
  }

  async create(organizationId, userId, payload, auditContext = {}) {
    let memberId = payload.memberId;

    if (!memberId && payload.member?.name) {
      const createdMember = await membersService.create(
        organizationId,
        userId,
        {
          name: payload.member.name,
          memberType: payload.member.memberType || 'person',
          documentType: payload.member.documentType || 'CC',
          documentNumber: payload.member.documentNumber,
          email: payload.member.email,
          phone: payload.member.phone,
          address: payload.member.address,
          notes: payload.member.notes,
          status: 'active',
        },
        auditContext,
      );
      memberId = createdMember._id;
    }

    if (!memberId) throw new ApiError(400, 'Debe indicar o crear un cliente');

    const member = await Member.findOne({ _id: memberId, organizationId }).lean();
    if (!member) throw new ApiError(404, 'Cliente no encontrado');

    let vehicleId = payload.vehicleId;
    if (!vehicleId && payload.plate) {
      const vehicle = await vehicleService.findOrCreateForMember(organizationId, {
        plate: payload.plate,
        vehicleCategoryId: payload.vehicleCategoryId,
        memberId,
      });
      vehicleId = vehicle._id;
    }

    if (!vehicleId) throw new ApiError(400, 'Debe indicar o registrar un vehículo (placa)');

    const vehicle = await Vehicle.findOne({ _id: vehicleId, organizationId });
    if (!vehicle) throw new ApiError(404, 'Vehículo no encontrado');

    if (String(vehicle.memberId ?? '') !== String(memberId)) {
      vehicle.memberId = memberId;
      await vehicle.save();
    }

    const active = await ParkingMembership.findOne({
      organizationId,
      vehicleId,
      status: MEMBERSHIP_STATUSES.ACTIVE,
    }).lean();
    if (active) {
      throw new ApiError(409, 'El vehículo ya tiene una mensualidad activa');
    }

    const startDate = new Date(payload.startDate);
    const endDate = new Date(payload.endDate);
    if (endDate <= startDate) {
      throw new ApiError(400, 'La fecha de vencimiento debe ser posterior al inicio');
    }

    const membership = await ParkingMembership.create({
      organizationId,
      memberId,
      vehicleId,
      membershipType: payload.membershipType || payload.name || 'Mensualidad',
      name: payload.name || payload.membershipType || 'Mensualidad',
      startDate,
      endDate,
      amount: Number(payload.amount) || 0,
      autoRenew: Boolean(payload.autoRenew),
      notes: payload.notes?.trim() || undefined,
      status: MEMBERSHIP_STATUSES.ACTIVE,
    });

    await auditService.log({
      userId,
      organizationId,
      module: 'memberships',
      action: MEMBERSHIP_AUDIT.CREATED,
      description: `Mensualidad creada: ${membership.name}`,
      entityType: 'parking_membership',
      entityId: membership._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.getById(organizationId, membership._id);
  }

  async update(organizationId, userId, id, payload, auditContext = {}) {
    const membership = await ParkingMembership.findOne({ _id: id, organizationId });
    if (!membership) throw new ApiError(404, 'Membresía no encontrada');

    const fields = ['name', 'membershipType', 'notes', 'amount', 'autoRenew'];
    for (const f of fields) {
      if (payload[f] !== undefined) membership[f] = payload[f];
    }
    if (payload.startDate) membership.startDate = new Date(payload.startDate);
    if (payload.endDate) membership.endDate = new Date(payload.endDate);

    await membership.save();

    await auditService.log({
      userId,
      organizationId,
      module: 'memberships',
      action: MEMBERSHIP_AUDIT.UPDATED,
      description: `Membresía actualizada: ${membership.name}`,
      entityType: 'parking_membership',
      entityId: membership._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.getById(organizationId, id);
  }

  async changeStatus(organizationId, userId, id, status, auditContext = {}) {
    if (!Object.values(MEMBERSHIP_STATUSES).includes(status)) {
      throw new ApiError(400, 'Estado inválido');
    }
    const membership = await ParkingMembership.findOne({ _id: id, organizationId });
    if (!membership) throw new ApiError(404, 'Membresía no encontrada');

    const prev = membership.status;
    membership.status = status;
    await membership.save();

    await auditService.log({
      userId,
      organizationId,
      module: 'memberships',
      action: MEMBERSHIP_AUDIT.STATUS_CHANGED,
      description: `Membresía ${prev} → ${status}`,
      entityType: 'parking_membership',
      entityId: membership._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      metadata: { from: prev, to: status },
    });

    return this.getById(organizationId, id);
  }

  async renew(organizationId, userId, id, payload, auditContext = {}) {
    const membership = await ParkingMembership.findOne({ _id: id, organizationId });
    if (!membership) throw new ApiError(404, 'Membresía no encontrada');

    const days = Number(payload.days) || 30;
    const base =
      membership.endDate > new Date() ? new Date(membership.endDate) : new Date();
    membership.startDate = membership.status === MEMBERSHIP_STATUSES.ACTIVE
      ? membership.startDate
      : new Date();
    membership.endDate = new Date(base.getTime() + days * 86400000);
    membership.status = MEMBERSHIP_STATUSES.ACTIVE;
    if (payload.amount !== undefined) membership.amount = Number(payload.amount);
    await membership.save();

    let payment = null;
    if (payload.recordPayment !== false && (payload.amount ?? membership.amount) > 0) {
      payment = await MembershipPayment.create({
        organizationId,
        memberId: membership.memberId,
        vehicleId: membership.vehicleId,
        parkingMembershipId: membership._id,
        amount: Number(payload.amount ?? membership.amount),
        method: payload.method || 'cash',
        receivedByUserId: userId,
        paidAt: new Date(),
        notes: payload.notes,
        kind: 'renewal',
      });
    }

    await auditService.log({
      userId,
      organizationId,
      module: 'memberships',
      action: MEMBERSHIP_AUDIT.RENEWED,
      description: `Membresía renovada hasta ${membership.endDate.toISOString().slice(0, 10)}`,
      entityType: 'parking_membership',
      entityId: membership._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    const detail = await this.getById(organizationId, id);
    return { ...detail, payment };
  }

  async recordUsage(organizationId, membershipId) {
    await ParkingMembership.updateOne(
      { _id: membershipId, organizationId },
      { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } },
    );
  }

  async recordPayment(organizationId, userId, payload, auditContext = {}) {
    const member = await Member.findOne({ _id: payload.memberId, organizationId }).lean();
    if (!member) throw new ApiError(404, 'Miembro no encontrado');

    if (payload.parkingMembershipId) {
      const m = await ParkingMembership.findOne({
        _id: payload.parkingMembershipId,
        organizationId,
      }).lean();
      if (!m) throw new ApiError(404, 'Membresía no encontrada');
    }

    const payment = await MembershipPayment.create({
      organizationId,
      memberId: payload.memberId,
      vehicleId: payload.vehicleId || null,
      parkingMembershipId: payload.parkingMembershipId || null,
      amount: Number(payload.amount),
      method: payload.method,
      receivedByUserId: userId,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
      notes: payload.notes?.trim() || null,
      kind: payload.kind || 'other',
    });

    await auditService.log({
      userId,
      organizationId,
      module: 'memberships',
      action: MEMBERSHIP_AUDIT.PAYMENT_RECORDED,
      description: `Pago de membresía $${payment.amount}`,
      entityType: 'membership_payment',
      entityId: payment._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return payment.toObject();
  }

  async listPayments(organizationId, { page = 1, limit = 20, memberId } = {}) {
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const match = { organizationId };
    if (memberId) match.memberId = memberId;

    const [items, total] = await Promise.all([
      MembershipPayment.find(match)
        .populate('memberId', 'name documentNumber')
        .populate('vehicleId', 'plate')
        .populate('parkingMembershipId', 'name')
        .populate('receivedByUserId', 'firstName lastName')
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      MembershipPayment.countDocuments(match),
    ]);

    return {
      items,
      pagination: {
        page: Math.max(1, Number(page) || 1),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }
}

export const parkingMembershipsService = new ParkingMembershipsService();
