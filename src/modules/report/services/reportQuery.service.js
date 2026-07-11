import mongoose from 'mongoose';
import Ticket from '#modules/ticket/ticket.model.js';
import Payment from '#modules/payment/payment.model.js';
import Vehicle from '#modules/vehicle/vehicle.model.js';
import Member from '#modules/member/member.model.js';
import ParkingMembership from '#modules/parkingMembership/parkingMembership.model.js';
import CashRegister from '#modules/cashRegister/cashRegister.model.js';
import AuditLog from '#modules/audit/auditLog.model.js';
import MembershipPayment from '#modules/parkingMembership/membershipPayment.model.js';
import { PAYMENT_KIND } from '#modules/payment/constants.js';
import { MEMBERSHIP_EXPIRING_DAYS, REPORT_TYPES } from '../constants.js';
import { reportsRepository } from '../repository/reports.repository.js';
import { reportDateRangeService } from './reportDateRange.service.js';
import {
  AUDIT_ACTIONS_HIDDEN_FROM_CLIENT,
  getAuditActionLabel,
  getAuditModuleLabel,
  humanizeAuditDescription,
} from '#services/audit/audit.labels.js';

const { Types } = mongoose;

const REPORT_COLUMNS = {
  [REPORT_TYPES.TICKETS]: [
    { key: 'plate', label: 'Placa' },
    { key: 'category', label: 'Categoría' },
    { key: 'status', label: 'Estado' },
    { key: 'entryAt', label: 'Ingreso' },
    { key: 'exitAt', label: 'Salida' },
    { key: 'durationMinutes', label: 'Minutos' },
    { key: 'total', label: 'Total' },
    { key: 'coveredByMembership', label: 'Membresía' },
  ],
  [REPORT_TYPES.VEHICLES]: [
    { key: 'plate', label: 'Placa' },
    { key: 'category', label: 'Categoría' },
    { key: 'member', label: 'Miembro' },
    { key: 'status', label: 'Estado' },
    { key: 'createdAt', label: 'Registro' },
  ],
  [REPORT_TYPES.MEMBERS]: [
    { key: 'name', label: 'Nombre' },
    { key: 'memberType', label: 'Tipo' },
    { key: 'documentNumber', label: 'Documento' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'status', label: 'Estado' },
  ],
  [REPORT_TYPES.MEMBERSHIPS]: [
    { key: 'name', label: 'Plan' },
    { key: 'member', label: 'Miembro' },
    { key: 'vehicle', label: 'Vehículo' },
    { key: 'startDate', label: 'Inicio' },
    { key: 'endDate', label: 'Fin' },
    { key: 'status', label: 'Estado' },
  ],
  [REPORT_TYPES.MEMBERSHIP_PAYMENTS]: [
    { key: 'paidAt', label: 'Fecha' },
    { key: 'member', label: 'Miembro' },
    { key: 'vehicle', label: 'Vehículo' },
    { key: 'amount', label: 'Valor' },
    { key: 'method', label: 'Método' },
    { key: 'kind', label: 'Tipo' },
    { key: 'receivedBy', label: 'Recibido por' },
  ],
  [REPORT_TYPES.FREQUENT_VEHICLES]: [
    { key: 'plate', label: 'Placa' },
    { key: 'entries', label: 'Ingresos' },
    { key: 'lastEntryAt', label: 'Último ingreso' },
  ],
  [REPORT_TYPES.FREQUENT_MEMBERS]: [
    { key: 'name', label: 'Cliente' },
    { key: 'documentNumber', label: 'Documento' },
    { key: 'entries', label: 'Ingresos' },
    { key: 'lastEntryAt', label: 'Último ingreso' },
  ],
  [REPORT_TYPES.PAYMENTS]: [
    { key: 'paidAt', label: 'Fecha' },
    { key: 'method', label: 'Método' },
    { key: 'amount', label: 'Monto' },
    { key: 'ticketId', label: 'Ticket' },
    { key: 'user', label: 'Cajero' },
    { key: 'status', label: 'Estado' },
  ],
  [REPORT_TYPES.CASH_REGISTERS]: [
    { key: 'cashPoint', label: 'Punto' },
    { key: 'user', label: 'Cajero' },
    { key: 'openedAt', label: 'Apertura' },
    { key: 'closedAt', label: 'Cierre' },
    { key: 'openingAmount', label: 'Fondo' },
    { key: 'calculatedAmount', label: 'Recaudado' },
    { key: 'closingAmount', label: 'Cierre declarado' },
    { key: 'difference', label: 'Diferencia' },
    { key: 'status', label: 'Estado' },
  ],
  [REPORT_TYPES.USERS]: [
    { key: 'name', label: 'Nombre' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Rol' },
    { key: 'status', label: 'Estado' },
    { key: 'lastLoginAt', label: 'Último acceso' },
    { key: 'createdAt', label: 'Alta' },
  ],
  [REPORT_TYPES.AUDIT]: [
    { key: 'createdAt', label: 'Fecha' },
    { key: 'module', label: 'Módulo' },
    { key: 'action', label: 'Acción' },
    { key: 'description', label: 'Descripción' },
    { key: 'user', label: 'Usuario' },
    { key: 'ip', label: 'IP' },
  ],
};

/**
 * Consultas de reportes paginados con filtros y agregaciones optimizadas.
 */
export class ReportQueryService {
  getColumns(reportType) {
    return REPORT_COLUMNS[reportType] ?? [];
  }

  async run(reportType, organizationId, filters = {}, pagination = {}) {
    const page = Math.max(1, Number(pagination.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(pagination.limit) || 20));
    const skip = (page - 1) * limit;

    const handlers = {
      [REPORT_TYPES.TICKETS]: () => this.#ticketsReport(organizationId, filters, skip, limit),
      [REPORT_TYPES.VEHICLES]: () => this.#vehiclesReport(organizationId, filters, skip, limit),
      [REPORT_TYPES.MEMBERS]: () => this.#membersReport(organizationId, filters, skip, limit),
      [REPORT_TYPES.MEMBERSHIPS]: () =>
        this.#membershipsReport(organizationId, filters, skip, limit),
      [REPORT_TYPES.MEMBERSHIP_PAYMENTS]: () =>
        this.#membershipPaymentsReport(organizationId, filters, skip, limit),
      [REPORT_TYPES.FREQUENT_VEHICLES]: () =>
        this.#frequentVehiclesReport(organizationId, filters, skip, limit),
      [REPORT_TYPES.FREQUENT_MEMBERS]: () =>
        this.#frequentMembersReport(organizationId, filters, skip, limit),
      [REPORT_TYPES.PAYMENTS]: () => this.#paymentsReport(organizationId, filters, skip, limit),
      [REPORT_TYPES.CASH_REGISTERS]: () =>
        this.#cashRegistersReport(organizationId, filters, skip, limit),
      [REPORT_TYPES.USERS]: () => this.#usersReport(organizationId, filters, skip, limit),
      [REPORT_TYPES.AUDIT]: () => this.#auditReport(organizationId, filters, skip, limit),
    };

    const handler = handlers[reportType];
    if (!handler) {
      return { columns: [], rows: [], pagination: { page, limit, totalRecords: 0, totalPages: 1 } };
    }

    const result = await handler();
    return {
      columns: this.getColumns(reportType),
      ...result,
      pagination: {
        page,
        limit,
        totalRecords: result.totalRecords,
        totalPages: Math.ceil(result.totalRecords / limit) || 1,
      },
    };
  }

  async #ticketsReport(organizationId, filters, skip, limit) {
    const orgId = new Types.ObjectId(organizationId);
    const timezone = await reportDateRangeService.getTimezone(organizationId);
    const match = { organizationId: orgId };

    if (filters.status) match.status = filters.status;
    if (filters.vehicleCategoryId)
      match.vehicleCategoryId = new Types.ObjectId(filters.vehicleCategoryId);
    if (filters.cashRegisterId) match.cashRegisterId = new Types.ObjectId(filters.cashRegisterId);
    if (filters.userId) match.entryUserId = new Types.ObjectId(filters.userId);

    const dateExpr = reportDateRangeService.buildDateFieldExpr('$entryAt', timezone, {
      from: filters.from,
      to: filters.to,
    });

    const pipeline = [
      { $match: match },
      ...(dateExpr ? [{ $match: { $expr: dateExpr } }] : []),
      {
        $lookup: {
          from: 'vehicles',
          localField: 'vehicleId',
          foreignField: '_id',
          as: 'vehicle',
          pipeline: [{ $project: { plate: 1 } }],
        },
      },
      { $unwind: { path: '$vehicle', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'vehiclecategories',
          localField: 'vehicleCategoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $sort: { entryAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                plate: '$vehicle.plate',
                category: '$category.name',
                status: 1,
                entryAt: 1,
                exitAt: 1,
                durationMinutes: 1,
                total: 1,
                coveredByMembership: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Ticket.aggregate(pipeline);
    return {
      rows: result.data,
      totalRecords: result.total[0]?.count ?? 0,
    };
  }

  async #vehiclesReport(organizationId, filters, skip, limit) {
    const orgId = new Types.ObjectId(organizationId);
    const match = { organizationId: orgId };
    if (filters.vehicleCategoryId)
      match.vehicleCategoryId = new Types.ObjectId(filters.vehicleCategoryId);
    if (filters.memberId) match.memberId = new Types.ObjectId(filters.memberId);
    if (filters.status) match.status = filters.status;

    const [rows, totalRecords] = await Promise.all([
      Vehicle.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('vehicleCategoryId', 'name')
        .populate('memberId', 'name')
        .select('plate status createdAt')
        .lean(),
      Vehicle.countDocuments(match),
    ]);

    return {
      rows: rows.map((v) => ({
        plate: v.plate,
        category: v.vehicleCategoryId?.name ?? '—',
        member: v.memberId?.name ?? 'Ocasional',
        status: v.status,
        createdAt: v.createdAt,
      })),
      totalRecords,
    };
  }

  async #membersReport(organizationId, filters, skip, limit) {
    const orgId = new Types.ObjectId(organizationId);
    const match = { organizationId: orgId };
    if (filters.memberId) match._id = new Types.ObjectId(filters.memberId);
    if (filters.status) match.status = filters.status;

    const [rows, totalRecords] = await Promise.all([
      Member.find(match)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .select('name memberType documentNumber phone status')
        .lean(),
      Member.countDocuments(match),
    ]);

    return { rows, totalRecords };
  }

  async #membershipsReport(organizationId, filters, skip, limit) {
    const orgId = new Types.ObjectId(organizationId);
    const match = { organizationId: orgId };
    if (filters.memberId) match.memberId = new Types.ObjectId(filters.memberId);
    if (filters.status) match.status = filters.status;

    const now = new Date();
    const scope = filters.membershipScope;
    if (scope === 'active') {
      match.status = 'active';
      match.endDate = { $gte: now };
    } else if (scope === 'expired' || scope === 'vencidas') {
      match.$or = [{ status: 'expired' }, { status: 'active', endDate: { $lt: now } }];
    } else if (scope === 'expiring' || scope === 'por_vencer') {
      const until = new Date(now.getTime() + MEMBERSHIP_EXPIRING_DAYS * 24 * 60 * 60 * 1000);
      match.status = 'active';
      match.endDate = { $gte: now, $lte: until };
    } else if (scope === 'renewals' || scope === 'renovaciones') {
      // Renovaciones ≈ membresías cuyo inicio cae en el rango (o últimos 30 días)
      const utcBounds = reportDateRangeService.parseUtcBounds(filters.from, filters.to);
      match.startDate = utcBounds ?? {
        $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      };
    }

    const [rows, totalRecords] = await Promise.all([
      ParkingMembership.find(match)
        .sort({ endDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('memberId', 'name')
        .populate('vehicleId', 'plate')
        .select('name startDate endDate status')
        .lean(),
      ParkingMembership.countDocuments(match),
    ]);

    return {
      rows: rows.map((m) => ({
        name: m.name,
        member: m.memberId?.name ?? '—',
        vehicle: m.vehicleId?.plate ?? '—',
        startDate: m.startDate,
        endDate: m.endDate,
        status: m.status,
      })),
      totalRecords,
    };
  }

  async #membershipPaymentsReport(organizationId, filters, skip, limit) {
    const orgId = new Types.ObjectId(organizationId);
    const match = { organizationId: orgId };
    if (filters.memberId) match.memberId = new Types.ObjectId(filters.memberId);
    if (filters.paymentMethod) match.method = filters.paymentMethod;

    const utcBounds = reportDateRangeService.parseUtcBounds(filters.from, filters.to);
    if (utcBounds) match.paidAt = utcBounds;

    const [rows, totalRecords] = await Promise.all([
      MembershipPayment.find(match)
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('memberId', 'name')
        .populate('vehicleId', 'plate')
        .populate('receivedByUserId', 'firstName lastName')
        .lean(),
      MembershipPayment.countDocuments(match),
    ]);

    return {
      rows: rows.map((p) => ({
        paidAt: p.paidAt,
        member: p.memberId?.name ?? '—',
        vehicle: p.vehicleId?.plate ?? '—',
        amount: p.amount,
        method: p.method,
        kind: p.kind,
        receivedBy: p.receivedByUserId
          ? `${p.receivedByUserId.firstName ?? ''} ${p.receivedByUserId.lastName ?? ''}`.trim()
          : '—',
      })),
      totalRecords,
    };
  }

  async #frequentVehiclesReport(organizationId, filters, skip, limit) {
    const orgId = new Types.ObjectId(organizationId);
    const match = { organizationId: orgId };
    const utcBounds = reportDateRangeService.parseUtcBounds(filters.from, filters.to);
    match.entryAt = utcBounds ?? { $gte: new Date(Date.now() - 30 * 86400000) };

    const [agg] = await Ticket.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$vehicleId',
          entries: { $sum: 1 },
          lastEntryAt: { $max: '$entryAt' },
        },
      },
      { $sort: { entries: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'vehicles',
                localField: '_id',
                foreignField: '_id',
                as: 'vehicle',
              },
            },
            { $unwind: '$vehicle' },
            {
              $project: {
                _id: 0,
                plate: '$vehicle.plate',
                entries: 1,
                lastEntryAt: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    return {
      rows: agg?.data ?? [],
      totalRecords: agg?.total?.[0]?.count ?? 0,
    };
  }

  async #frequentMembersReport(organizationId, filters, skip, limit) {
    const orgId = new Types.ObjectId(organizationId);
    const match = {
      organizationId: orgId,
      memberId: { $ne: null },
    };
    const utcBounds = reportDateRangeService.parseUtcBounds(filters.from, filters.to);
    match.entryAt = utcBounds ?? { $gte: new Date(Date.now() - 30 * 86400000) };

    const [agg] = await Ticket.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$memberId',
          entries: { $sum: 1 },
          lastEntryAt: { $max: '$entryAt' },
        },
      },
      { $sort: { entries: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'members',
                localField: '_id',
                foreignField: '_id',
                as: 'member',
              },
            },
            { $unwind: '$member' },
            {
              $project: {
                _id: 0,
                name: '$member.name',
                documentNumber: '$member.documentNumber',
                entries: 1,
                lastEntryAt: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    return {
      rows: agg?.data ?? [],
      totalRecords: agg?.total?.[0]?.count ?? 0,
    };
  }

  async #paymentsReport(organizationId, filters, skip, limit) {
    const orgId = new Types.ObjectId(organizationId);
    const timezone = await reportDateRangeService.getTimezone(organizationId);
    const match = {
      organizationId: orgId,
      kind: PAYMENT_KIND.CHARGE,
    };
    if (filters.paymentMethod) match.method = filters.paymentMethod;
    if (filters.cashRegisterId) match.cashRegisterId = new Types.ObjectId(filters.cashRegisterId);
    if (filters.userId) match.userId = new Types.ObjectId(filters.userId);
    if (filters.status) match.status = filters.status;

    const utcBounds = reportDateRangeService.parseUtcBounds(filters.from, filters.to);
    if (utcBounds) match.paidAt = utcBounds;

    const dateExpr = reportDateRangeService.buildDateFieldExpr('$paidAt', timezone, {
      from: filters.from,
      to: filters.to,
    });

    const pipeline = [
      { $match: match },
      ...(dateExpr ? [{ $match: { $expr: dateExpr } }] : []),
      { $sort: { paidAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
                pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
              },
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                paidAt: 1,
                method: 1,
                amount: 1,
                ticketId: 1,
                user: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
                status: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Payment.aggregate(pipeline);
    return {
      rows: result.data,
      totalRecords: result.total[0]?.count ?? 0,
    };
  }

  async #cashRegistersReport(organizationId, filters, skip, limit) {
    const orgId = new Types.ObjectId(organizationId);
    const match = { organizationId: orgId };
    if (filters.status) match.status = filters.status;
    if (filters.userId) match.userId = new Types.ObjectId(filters.userId);
    if (filters.cashRegisterId) match._id = new Types.ObjectId(filters.cashRegisterId);

    const utcBounds = reportDateRangeService.parseUtcBounds(filters.from, filters.to);
    if (utcBounds) match.openedAt = utcBounds;

    const [rows, totalRecords] = await Promise.all([
      CashRegister.find(match)
        .sort({ openedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('cashPointId', 'name')
        .populate('userId', 'firstName lastName')
        .select('openedAt closedAt openingAmount calculatedAmount closingAmount difference status')
        .lean(),
      CashRegister.countDocuments(match),
    ]);

    return {
      rows: rows.map((r) => ({
        cashPoint: r.cashPointId?.name ?? '—',
        user: r.userId ? `${r.userId.firstName} ${r.userId.lastName}` : '—',
        openedAt: r.openedAt,
        closedAt: r.closedAt,
        openingAmount: r.openingAmount,
        calculatedAmount: r.calculatedAmount,
        closingAmount: r.closingAmount,
        difference: r.difference,
        status: r.status,
      })),
      totalRecords,
    };
  }

  async #usersReport(organizationId, filters, skip, limit) {
    return reportsRepository.usersActivity(organizationId, filters, skip, limit);
  }

  async #auditReport(organizationId, filters, skip, limit) {
    const orgId = new Types.ObjectId(organizationId);
    const match = {
      organizationId: orgId,
      action: { $nin: [...AUDIT_ACTIONS_HIDDEN_FROM_CLIENT] },
    };
    const utcBounds = reportDateRangeService.parseUtcBounds(filters.from, filters.to);
    if (utcBounds) match.createdAt = utcBounds;
    if (filters.userId) match.userId = new Types.ObjectId(filters.userId);

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
                pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }],
              },
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                createdAt: 1,
                module: 1,
                action: 1,
                description: 1,
                userName: {
                  $trim: {
                    input: {
                      $concat: [
                        { $ifNull: ['$user.firstName', ''] },
                        ' ',
                        { $ifNull: ['$user.lastName', ''] },
                      ],
                    },
                  },
                },
                userEmail: { $ifNull: ['$user.email', null] },
                ip: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await AuditLog.aggregate(pipeline);
    return {
      rows: (result.data ?? []).map((row) => {
        const name = row.userName?.trim();
        return {
          createdAt: row.createdAt,
          module: getAuditModuleLabel(row.module),
          action: getAuditActionLabel(row.action),
          description: humanizeAuditDescription(row.description, {
            action: row.action,
            module: row.module,
          }),
          user: name || row.userEmail || 'Sistema',
          ip: row.ip,
        };
      }),
      totalRecords: result.total[0]?.count ?? 0,
    };
  }

  async getFilterOptions(organizationId) {
    const orgId = new Types.ObjectId(organizationId);

    const [categories, cashRegisters, users] = await Promise.all([
      mongoose.connection.db
        .collection('vehiclecategories')
        .find({ organizationId: orgId, isDeleted: { $ne: true }, isActive: true })
        .project({ name: 1 })
        .sort({ displayOrder: 1 })
        .toArray(),
      CashRegister.find({ organizationId: orgId })
        .sort({ openedAt: -1 })
        .limit(50)
        .populate('cashPointId', 'name')
        .select('status openedAt')
        .lean(),
      mongoose.connection.db
        .collection('users')
        .find({ organizationId: orgId, status: 'active' })
        .project({ firstName: 1, lastName: 1, email: 1 })
        .toArray(),
    ]);

    return {
      vehicleCategories: categories.map((c) => ({ id: c._id, name: c.name })),
      cashRegisters: cashRegisters.map((r) => ({
        id: r._id,
        label: `${r.cashPointId?.name ?? 'Caja'} — ${new Date(r.openedAt).toLocaleDateString('es-CO')}`,
        status: r.status,
      })),
      users: users.map((u) => ({
        id: u._id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
      })),
      ticketStatuses: ['open', 'closed', 'cancelled'],
      membershipScopes: [
        { id: 'active', label: 'Activas' },
        { id: 'expired', label: 'Vencidas' },
        { id: 'expiring', label: 'Próximas a vencer' },
        { id: 'renewals', label: 'Renovaciones' },
      ],
      userStatuses: ['active', 'inactive', 'pending_verification'],
      paymentMethods: ['cash', 'card', 'transfer', 'nequi', 'daviplata', 'other', 'membership'],
    };
  }
}

export const reportQueryService = new ReportQueryService();
