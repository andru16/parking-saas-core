import CashRegister from './cashRegister.model.js';
import CashPoint from '#modules/cashPoint/cashPoint.model.js';
import Ticket from '#modules/ticket/ticket.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { paymentService } from '#modules/payment/payment.service.js';
import { CASH_REGISTER_STATUS, CASH_REGISTER_AUDIT_ACTIONS } from './constants.js';

const SESSION_POPULATE = [
  { path: 'cashPointId', select: 'name status' },
  { path: 'userId', select: 'firstName lastName email' },
];

/**
 * Servicio de caja — apertura, cierre, reportes e historial.
 */
export class CashRegisterService {
  async listCashPoints(organizationId) {
    const points = await CashPoint.find({
      organizationId,
      status: 'active',
    })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    return points.map((p) => ({
      id: p._id,
      name: p.name,
      status: p.status,
      displayOrder: p.displayOrder,
    }));
  }

  async getOpenSession(organizationId, userId) {
    const session = await CashRegister.findOne({
      organizationId,
      userId,
      status: CASH_REGISTER_STATUS.OPEN,
    })
      .populate(SESSION_POPULATE)
      .lean();

    return session ? this.#formatSession(session) : null;
  }

  async assertOpenSession(organizationId, userId) {
    const session = await CashRegister.findOne({
      organizationId,
      userId,
      status: CASH_REGISTER_STATUS.OPEN,
    }).lean();

    if (!session) {
      throw new ApiError(
        403,
        'Debe abrir la caja antes de registrar operaciones. Abra un turno de caja primero.',
      );
    }

    return session;
  }

  async openSession(organizationId, userId, payload = {}, auditContext = {}) {
    let { cashPointId, openingAmount = 0, openingNotes = null } = payload;

    if (!cashPointId) {
      const activePoints = await CashPoint.find({
        organizationId,
        status: 'active',
      })
        .sort({ displayOrder: 1, name: 1 })
        .lean();

      if (activePoints.length === 0) {
        throw new ApiError(400, 'No hay puntos de caja configurados. Complete el setup primero.');
      }

      if (activePoints.length === 1) {
        cashPointId = activePoints[0]._id;
      } else {
        throw new ApiError(400, 'Debe seleccionar el punto de caja');
      }
    }

    const cashPoint = await CashPoint.findOne({
      _id: cashPointId,
      organizationId,
      status: 'active',
    }).lean();

    if (!cashPoint) {
      throw new ApiError(404, 'Punto de caja no encontrado o inactivo');
    }

    const userOpen = await CashRegister.findOne({
      organizationId,
      userId,
      status: CASH_REGISTER_STATUS.OPEN,
    }).lean();

    if (userOpen) {
      throw new ApiError(409, 'Ya tiene una caja abierta. Cierre el turno actual primero.');
    }

    const pointOpen = await CashRegister.findOne({
      organizationId,
      cashPointId,
      status: CASH_REGISTER_STATUS.OPEN,
    }).lean();

    if (pointOpen) {
      throw new ApiError(409, 'Este punto de caja ya está en uso. Seleccione otro punto.');
    }

    const [session] = await CashRegister.create([
      {
        organizationId,
        cashPointId,
        userId,
        openingAmount,
        openingNotes,
        status: CASH_REGISTER_STATUS.OPEN,
        openedAt: new Date(),
      },
    ]);

    await auditService.log({
      userId,
      organizationId,
      module: 'cash_register',
      action: CASH_REGISTER_AUDIT_ACTIONS.OPENED,
      description: 'Apertura de caja',
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      resourceId: session._id,
      metadata: { cashPointId, openingAmount },
    });

    return this.getById(organizationId, session._id);
  }

  async closeSession(organizationId, userId, payload = {}, auditContext = {}) {
    const { closingAmount, notes = null, confirmed = false } = payload;

    if (!confirmed) {
      await auditService.log({
        userId,
        organizationId,
        module: 'cash_register',
        action: CASH_REGISTER_AUDIT_ACTIONS.CLOSE_ATTEMPT_FAILED,
        description: 'Intento de cierre sin confirmación',
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
      });
      throw new ApiError(400, 'Debe confirmar el cierre de caja');
    }

    if (closingAmount == null || closingAmount < 0) {
      throw new ApiError(400, 'El monto de cierre reportado es obligatorio');
    }

    const session = await CashRegister.findOne({
      organizationId,
      userId,
      status: CASH_REGISTER_STATUS.OPEN,
    });

    if (!session) {
      throw new ApiError(404, 'No tiene una caja abierta');
    }

    const openTickets = await Ticket.countDocuments({
      organizationId,
      cashRegisterId: session._id,
      status: 'open',
    });

    if (openTickets > 0) {
      throw new ApiError(
        409,
        `Hay ${openTickets} ticket(s) abierto(s) en este turno. Cierre todos antes de cerrar la caja.`,
      );
    }

    const summary = await paymentService.aggregateForCashRegister(organizationId, session._id);
    const expectedCash = session.openingAmount + (summary.totalsByMethod.cash ?? 0);
    const difference = closingAmount - expectedCash;

    session.status = CASH_REGISTER_STATUS.CLOSED;
    session.closedAt = new Date();
    session.closingAmount = closingAmount;
    session.calculatedAmount = summary.totalCollected;
    session.difference = difference;
    session.notes = notes;
    session.closingSummary = {
      totalCollected: summary.totalCollected,
      totalsByMethod: summary.totalsByMethod,
      ticketsPaid: summary.ticketsPaid,
      ticketsMembership: summary.ticketsMembership,
      ticketsFree: summary.ticketsFree,
      ticketsClosed: summary.ticketsClosed,
      incomeByHour: summary.incomeByHour,
    };
    await session.save();

    await auditService.log({
      userId,
      organizationId,
      module: 'cash_register',
      action: CASH_REGISTER_AUDIT_ACTIONS.CLOSED,
      description: 'Cierre de caja',
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      resourceId: session._id,
      metadata: {
        closingAmount,
        calculatedAmount: summary.totalCollected,
        difference,
        summary,
      },
    });

    return this.getById(organizationId, session._id);
  }

  async getLiveSummary(organizationId, userId) {
    const session = await this.assertOpenSession(organizationId, userId);
    const paymentSummary = await paymentService.aggregateForCashRegister(
      organizationId,
      session._id,
    );

    const [openTickets, closedTickets] = await Promise.all([
      Ticket.countDocuments({
        organizationId,
        cashRegisterId: session._id,
        status: 'open',
      }),
      Ticket.countDocuments({
        organizationId,
        cashRegisterId: session._id,
        status: 'closed',
      }),
    ]);

    return {
      sessionId: session._id,
      openingAmount: session.openingAmount,
      openedAt: session.openedAt,
      ...paymentSummary,
      openTickets,
      closedTickets,
      vehiclesServed: closedTickets,
    };
  }

  async listHistory(organizationId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      CashRegister.find({ organizationId, status: CASH_REGISTER_STATUS.CLOSED })
        .sort({ closedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(SESSION_POPULATE)
        .lean(),
      CashRegister.countDocuments({ organizationId, status: CASH_REGISTER_STATUS.CLOSED }),
    ]);

    return {
      sessions: items.map((s) => this.#formatSession(s)),
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getById(organizationId, sessionId) {
    const session = await CashRegister.findOne({
      _id: sessionId,
      organizationId,
    })
      .populate(SESSION_POPULATE)
      .lean();

    if (!session) {
      throw new ApiError(404, 'Sesión de caja no encontrada');
    }

    return this.#formatSession(session);
  }

  #formatSession(session) {
    const cashPoint = session.cashPointId;
    const user = session.userId;
    const summary = session.closingSummary;

    return {
      id: session._id,
      status: session.status,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openingAmount: session.openingAmount,
      openingNotes: session.openingNotes,
      closingAmount: session.closingAmount,
      calculatedAmount: session.calculatedAmount,
      difference: session.difference,
      notes: session.notes,
      cashPoint: cashPoint
        ? {
            id: cashPoint._id ?? cashPoint,
            name: cashPoint.name,
            status: cashPoint.status,
          }
        : null,
      user: user
        ? {
            id: user._id ?? user,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          }
        : null,
      closingSummary: summary
        ? {
            totalCollected: summary.totalCollected ?? 0,
            totalsByMethod:
              summary.totalsByMethod instanceof Map
                ? Object.fromEntries(summary.totalsByMethod)
                : (summary.totalsByMethod ?? {}),
            ticketsPaid: summary.ticketsPaid ?? 0,
            ticketsMembership: summary.ticketsMembership ?? 0,
            ticketsFree: summary.ticketsFree ?? 0,
            ticketsClosed: summary.ticketsClosed ?? 0,
            incomeByHour: summary.incomeByHour ?? [],
          }
        : null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}

export const cashRegisterService = new CashRegisterService();
