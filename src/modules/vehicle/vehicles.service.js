import mongoose from 'mongoose';
import Vehicle from '#modules/vehicle/vehicle.model.js';
import Ticket from '#modules/ticket/ticket.model.js';
import Payment from '#modules/payment/payment.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { parkingMembershipQueryService } from '#services/membership/parkingMembershipQuery.service.js';
import { VEHICLE_AUDIT } from '#modules/parkingMembership/constants.js';
import { vehicleService } from '#services/vehicle/vehicle.service.js';

/**
 * Consulta de vehículos (no CRUD primario — se crean en operaciones).
 */
export class VehiclesConsultService {
  async list(organizationId, { search, status, presence, page = 1, limit = 20 } = {}) {
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const match = { organizationId };
    if (status) match.status = status;
    if (search?.trim()) {
      const s = vehicleService.normalizePlate(search);
      match.$or = [
        { plate: { $regex: s, $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const [vehicles, total, openTickets] = await Promise.all([
      Vehicle.find(match)
        .populate('vehicleCategoryId', 'name color icon')
        .populate('memberId', 'name documentNumber phone')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      Vehicle.countDocuments(match),
      Ticket.find({ organizationId, status: 'open' }).select('vehicleId entryAt').lean(),
    ]);

    const openByVehicle = new Map(
      openTickets.map((t) => [String(t.vehicleId), t]),
    );

    let items = vehicles.map((v) => {
      const open = openByVehicle.get(String(v._id));
      return {
        ...v,
        presence: open ? 'inside' : 'outside',
        currentEntryAt: open?.entryAt ?? null,
      };
    });

    if (presence === 'inside') items = items.filter((v) => v.presence === 'inside');
    if (presence === 'outside') items = items.filter((v) => v.presence === 'outside');

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

  async getById(organizationId, vehicleId) {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, organizationId })
      .populate('vehicleCategoryId', 'name color icon')
      .populate('memberId', 'name documentNumber phone email address')
      .lean();
    if (!vehicle) throw new ApiError(404, 'Vehículo no encontrado');

    const [openTicket, membership, tickets, paymentAgg] = await Promise.all([
      Ticket.findOne({ organizationId, vehicleId, status: 'open' }).lean(),
      parkingMembershipQueryService.findActiveForVehicle(organizationId, vehicleId),
      Ticket.find({ organizationId, vehicleId })
        .sort({ entryAt: -1 })
        .limit(40)
        .select('status entryAt exitAt total durationMinutes coveredByMembership')
        .lean(),
      Payment.aggregate([
        {
          $match: {
            organizationId:
              typeof organizationId === 'string'
                ? new mongoose.Types.ObjectId(organizationId)
                : organizationId,
            kind: 'charge',
            status: 'completed',
            method: { $ne: 'membership' },
          },
        },
        {
          $lookup: {
            from: 'tickets',
            localField: 'ticketId',
            foreignField: '_id',
            as: 'ticket',
          },
        },
        { $unwind: '$ticket' },
        {
          $match: {
            'ticket.vehicleId':
              typeof vehicle._id === 'string'
                ? new mongoose.Types.ObjectId(vehicle._id)
                : vehicle._id,
          },
        },
        {
          $group: {
            _id: null,
            totalCollected: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const closed = tickets.filter((t) => t.status === 'closed' && t.durationMinutes != null);
    const avgStay =
      closed.length > 0
        ? Math.round(closed.reduce((a, t) => a + (t.durationMinutes || 0), 0) / closed.length)
        : null;

    const lastEntry = tickets[0]?.entryAt ?? null;
    const lastExit = tickets.find((t) => t.exitAt)?.exitAt ?? null;

    return {
      vehicle: {
        ...vehicle,
        presence: openTicket ? 'inside' : 'outside',
        currentEntryAt: openTicket?.entryAt ?? null,
      },
      stats: {
        totalEntries: tickets.length,
        totalCollected: paymentAgg[0]?.totalCollected ?? 0,
        averageStayMinutes: avgStay,
        lastEntryAt: lastEntry,
        lastExitAt: lastExit,
        hasActiveMembership: Boolean(membership),
      },
      activeMembership: membership,
      owner: vehicle.memberId ?? null,
      history: tickets,
    };
  }

  async update(organizationId, userId, vehicleId, payload, auditContext = {}) {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, organizationId });
    if (!vehicle) throw new ApiError(404, 'Vehículo no encontrado');

    if (payload.notes !== undefined) vehicle.notes = payload.notes;
    if (payload.status && ['active', 'inactive'].includes(payload.status)) {
      vehicle.status = payload.status;
    }
    if (payload.memberId !== undefined) {
      vehicle.memberId = payload.memberId || null;
    }
    if (payload.vehicleCategoryId) {
      vehicle.vehicleCategoryId = payload.vehicleCategoryId;
    }

    await vehicle.save();

    await auditService.log({
      userId,
      organizationId,
      module: 'vehicles',
      action: VEHICLE_AUDIT.UPDATED,
      description: `Vehículo actualizado: ${vehicle.plate}`,
      entityType: 'vehicle',
      entityId: vehicle._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.getById(organizationId, vehicleId);
  }

  async frequent(organizationId, { days = 30, limit = 10 } = {}) {
    const since = new Date(Date.now() - days * 86400000);
    const orgOid =
      typeof organizationId === 'string'
        ? new mongoose.Types.ObjectId(organizationId)
        : organizationId;

    const rows = await Ticket.aggregate([
      {
        $match: {
          organizationId: orgOid,
          entryAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: '$vehicleId',
          entries: { $sum: 1 },
          lastEntryAt: { $max: '$entryAt' },
        },
      },
      { $sort: { entries: -1 } },
      { $limit: Math.min(50, Number(limit) || 10) },
      {
        $lookup: {
          from: 'vehicles',
          localField: '_id',
          foreignField: '_id',
          as: 'vehicle',
        },
      },
      { $unwind: '$vehicle' },
    ]);

    return rows.map((r) => ({
      vehicleId: r._id,
      plate: r.vehicle.plate,
      entries: r.entries,
      lastEntryAt: r.lastEntryAt,
    }));
  }
}

export const vehiclesConsultService = new VehiclesConsultService();
