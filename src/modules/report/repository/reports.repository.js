import mongoose from 'mongoose';
import Ticket from '#modules/ticket/ticket.model.js';
import Payment from '#modules/payment/payment.model.js';
import ParkingMembership from '#modules/parkingMembership/parkingMembership.model.js';
import CashRegister from '#modules/cashRegister/cashRegister.model.js';
import User from '#modules/user/user.model.js';
import { PAYMENT_KIND, PAYMENT_STATUS } from '#modules/payment/constants.js';
import { MEMBERSHIP_EXPIRING_DAYS } from '../constants.js';
import { reportDateRangeService } from '../services/reportDateRange.service.js';
import { settingsService } from '#modules/systemSettings/settings.service.js';
import MembershipPayment from '#modules/parkingMembership/membershipPayment.model.js';

const { Types } = mongoose;

/**
 * ReportsRepository — agregaciones MongoDB reutilizables (sin duplicar queries).
 * Usado por DashboardService y ReportQueryService.
 */
export class ReportsRepository {
  orgId(organizationId) {
    return new Types.ObjectId(organizationId);
  }

  paymentChargeMatch(organizationId) {
    return {
      organizationId: this.orgId(organizationId),
      kind: PAYMENT_KIND.CHARGE,
      status: PAYMENT_STATUS.COMPLETED,
    };
  }

  async countEntriesToday(organizationId, timezone, today) {
    return Ticket.countDocuments({
      organizationId: this.orgId(organizationId),
      $expr: reportDateRangeService.buildDateFieldExpr('$entryAt', timezone, { day: today }),
    });
  }

  async countExitsToday(organizationId, timezone, today) {
    return Ticket.countDocuments({
      organizationId: this.orgId(organizationId),
      status: 'closed',
      $expr: reportDateRangeService.buildDateFieldExpr('$exitAt', timezone, { day: today }),
    });
  }

  async countOpenTickets(organizationId) {
    return Ticket.countDocuments({
      organizationId: this.orgId(organizationId),
      status: 'open',
    });
  }

  async countTicketsTotal(organizationId) {
    return Ticket.countDocuments({ organizationId: this.orgId(organizationId) });
  }

  async sumRevenueForDay(organizationId, timezone, today) {
    const [row] = await Payment.aggregate([
      { $match: this.paymentChargeMatch(organizationId) },
      {
        $match: {
          $expr: reportDateRangeService.buildDateFieldExpr('$paidAt', timezone, { day: today }),
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return row?.total ?? 0;
  }

  async sumRevenueForMonth(organizationId, timezone, month) {
    const [row] = await Payment.aggregate([
      { $match: this.paymentChargeMatch(organizationId) },
      {
        $match: {
          $expr: reportDateRangeService.buildDateFieldExpr('$paidAt', timezone, { month }),
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return row?.total ?? 0;
  }

  async countActiveMemberships(organizationId) {
    const now = new Date();
    return ParkingMembership.countDocuments({
      organizationId: this.orgId(organizationId),
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
  }

  async countExpiringMemberships(organizationId, withinDays = MEMBERSHIP_EXPIRING_DAYS) {
    const now = new Date();
    const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    return ParkingMembership.countDocuments({
      organizationId: this.orgId(organizationId),
      status: 'active',
      endDate: { $gte: now, $lte: until },
    });
  }

  async countExpiredMemberships(organizationId) {
    const now = new Date();
    return ParkingMembership.countDocuments({
      organizationId: this.orgId(organizationId),
      $or: [
        { status: 'expired' },
        { status: 'active', endDate: { $lt: now } },
      ],
    });
  }

  async sumMembershipPayments(organizationId, { days = 30 } = {}) {
    const since = new Date(Date.now() - days * 86400000);
    const [row] = await MembershipPayment.aggregate([
      {
        $match: {
          organizationId: this.orgId(organizationId),
          paidAt: { $gte: since },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return row?.total ?? 0;
  }

  async countCashOpen(organizationId) {
    return CashRegister.countDocuments({
      organizationId: this.orgId(organizationId),
      status: 'open',
    });
  }

  async countCashClosedToday(organizationId, timezone, today) {
    return CashRegister.countDocuments({
      organizationId: this.orgId(organizationId),
      status: 'closed',
      $expr: reportDateRangeService.buildDateFieldExpr('$closedAt', timezone, { day: today }),
    });
  }

  async countActiveCashiers(organizationId) {
    const ids = await CashRegister.distinct('userId', {
      organizationId: this.orgId(organizationId),
      status: 'open',
    });
    return ids.length;
  }

  async getMaxCapacity(organizationId) {
    return settingsService.getOrgMaxCapacity(organizationId);
  }

  async countOccasionalInside(organizationId) {
    const [row] = await Ticket.aggregate([
      { $match: { organizationId: this.orgId(organizationId), status: 'open' } },
      {
        $lookup: {
          from: 'vehicles',
          localField: 'vehicleId',
          foreignField: '_id',
          as: 'vehicle',
        },
      },
      { $unwind: '$vehicle' },
      { $match: { 'vehicle.memberId': null } },
      { $count: 'total' },
    ]);
    return row?.total ?? 0;
  }

  async ticketsByHourToday(organizationId, timezone, today) {
    return Ticket.aggregate([
      {
        $match: {
          organizationId: this.orgId(organizationId),
          $expr: reportDateRangeService.buildDateFieldExpr('$entryAt', timezone, { day: today }),
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%H', date: '$entryAt', timezone } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, hour: '$_id', count: 1 } },
    ]);
  }

  async incomeByMonth(organizationId, timezone, months = 12) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    return Payment.aggregate([
      {
        $match: {
          ...this.paymentChargeMatch(organizationId),
          paidAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: '$_id', total: 1, count: 1 } },
    ]);
  }

  async occupancyHistory(organizationId, timezone, days = 14) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    // Proxy de ocupación: promedio de tickets abiertos al cierre del día ≈ entradas - salidas acumuladas es costoso;
    // usamos pico de tickets abiertos aproximado por entradas del día.
    return Ticket.aggregate([
      {
        $match: {
          organizationId: this.orgId(organizationId),
          entryAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$entryAt', timezone } },
          entries: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', entries: 1 } },
    ]);
  }

  async usersActivity(organizationId, filters, skip, limit) {
    const match = { organizationId: this.orgId(organizationId) };
    if (filters.status) match.status = filters.status;
    if (filters.userId) match._id = this.orgId(filters.userId);

    const [rows, totalRecords] = await Promise.all([
      User.find(match)
        .sort({ lastLoginAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('organizationRoleId', 'key name')
        .select('firstName lastName email status lastLoginAt createdAt')
        .lean(),
      User.countDocuments(match),
    ]);

    return {
      rows: rows.map((u) => ({
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        email: u.email,
        role: u.organizationRoleId?.name ?? u.organizationRoleId?.key ?? '—',
        status: u.status,
        lastLoginAt: u.lastLoginAt ?? null,
        createdAt: u.createdAt,
      })),
      totalRecords,
    };
  }
}

export const reportsRepository = new ReportsRepository();
