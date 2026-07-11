import { reportsRepository } from '../repository/reports.repository.js';
import { reportDateRangeService } from './reportDateRange.service.js';
import Ticket from '#modules/ticket/ticket.model.js';
import Payment from '#modules/payment/payment.model.js';
import { PAYMENT_KIND, PAYMENT_STATUS } from '#modules/payment/constants.js';
import mongoose from 'mongoose';

const { Types } = mongoose;

/**
 * KPIs y gráficas del dashboard analítico.
 * Delega conteos/agregaciones a ReportsRepository (sin duplicar consultas).
 */
export class DashboardService {
  async getKpis(organizationId) {
    const timezone = await reportDateRangeService.getTimezone(organizationId);
    const today = reportDateRangeService.getTodayString(timezone);
    const month = reportDateRangeService.getMonthString(timezone);
    const repo = reportsRepository;

    const [
      entriesToday,
      closedToday,
      openTickets,
      ticketsTotal,
      revenueToday,
      revenueMonth,
      membershipsActive,
      membershipsExpiring,
      membershipsExpired,
      membershipRevenue,
      occasionalInside,
      cashOpen,
      cashClosedToday,
      activeCashiers,
      maxCapacity,
    ] = await Promise.all([
      repo.countEntriesToday(organizationId, timezone, today),
      repo.countExitsToday(organizationId, timezone, today),
      repo.countOpenTickets(organizationId),
      repo.countTicketsTotal(organizationId),
      repo.sumRevenueForDay(organizationId, timezone, today),
      repo.sumRevenueForMonth(organizationId, timezone, month),
      repo.countActiveMemberships(organizationId),
      repo.countExpiringMemberships(organizationId),
      repo.countExpiredMemberships(organizationId),
      repo.sumMembershipPayments(organizationId, { days: 30 }),
      repo.countOccasionalInside(organizationId),
      repo.countCashOpen(organizationId),
      repo.countCashClosedToday(organizationId, timezone, today),
      repo.countActiveCashiers(organizationId),
      repo.getMaxCapacity(organizationId),
    ]);

    const vehiclesInside = openTickets;

    return {
      entriesToday,
      exitsToday: closedToday,
      vehiclesInside,
      openTickets,
      closedTicketsToday: closedToday,
      ticketsTotal,
      revenueToday,
      revenueMonth,
      vehiclesWithMembership: membershipsActive,
      membershipsActive,
      membershipsExpiring,
      membershipsExpired,
      membershipRevenue,
      occasionalVehiclesInside: occasionalInside,
      cashRegistersOpen: cashOpen,
      cashRegistersClosedToday: cashClosedToday,
      cashOpen,
      cashClosed: cashClosedToday,
      activeCashiers,
      occupancy: maxCapacity
        ? {
            current: vehiclesInside,
            max: maxCapacity,
            percent: Math.round((vehiclesInside / maxCapacity) * 100),
          }
        : null,
      timezone,
      asOf: new Date().toISOString(),
    };
  }

  async getCharts(organizationId, { days = 30 } = {}) {
    const orgId = new Types.ObjectId(organizationId);
    const timezone = await reportDateRangeService.getTimezone(organizationId);
    const today = reportDateRangeService.getTodayString(timezone);
    const repo = reportsRepository;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const paymentBase = {
      organizationId: orgId,
      kind: PAYMENT_KIND.CHARGE,
      status: PAYMENT_STATUS.COMPLETED,
      paidAt: { $gte: since },
    };

    const [
      incomeByDay,
      incomeByHour,
      incomeByMonth,
      ticketsByHour,
      vehiclesByCategory,
      paymentMethods,
      revenueEvolution,
      occupancyCurrent,
      occupancyHistory,
      membershipsActive,
      maxCapacity,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: paymentBase },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone },
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', total: 1, count: 1 } },
      ]),
      Payment.aggregate([
        { $match: paymentBase },
        {
          $match: {
            $expr: reportDateRangeService.buildDateFieldExpr('$paidAt', timezone, { day: today }),
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%H', date: '$paidAt', timezone } },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, hour: '$_id', total: 1 } },
      ]),
      repo.incomeByMonth(organizationId, timezone, 12),
      repo.ticketsByHourToday(organizationId, timezone, today),
      Ticket.aggregate([
        { $match: { organizationId: orgId, status: 'open' } },
        { $group: { _id: '$vehicleCategoryId', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'vehiclecategories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            categoryId: '$_id',
            name: { $ifNull: ['$category.name', 'Sin categoría'] },
            color: '$category.color',
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),
      Payment.aggregate([
        { $match: paymentBase },
        {
          $match: {
            $expr: reportDateRangeService.buildDateFieldExpr('$paidAt', timezone, {
              month: reportDateRangeService.getMonthString(timezone),
            }),
          },
        },
        { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
      ]),
      Payment.aggregate([
        { $match: paymentBase },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone } },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
        {
          $setWindowFields: {
            sortBy: { _id: 1 },
            output: {
              cumulative: { $sum: '$total', window: { documents: ['unbounded', 'current'] } },
            },
          },
        },
        { $project: { _id: 0, date: '$_id', total: 1, cumulative: 1 } },
      ]),
      repo.countOpenTickets(organizationId),
      repo.occupancyHistory(organizationId, timezone, Math.min(days, 30)),
      repo.countActiveMemberships(organizationId),
      repo.getMaxCapacity(organizationId),
    ]);

    return {
      incomeByDay,
      incomeByHour,
      incomeByMonth,
      ticketsByHour,
      vehiclesByCategory,
      paymentMethods,
      revenueEvolution,
      membershipsActive: { count: membershipsActive },
      occupancy: {
        current: occupancyCurrent,
        max: maxCapacity,
        percent: maxCapacity ? Math.round((occupancyCurrent / maxCapacity) * 100) : null,
        history: occupancyHistory,
      },
      timezone,
    };
  }
}

export const dashboardService = new DashboardService();
