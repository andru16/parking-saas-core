import Payment from './payment.model.js';
import Ticket from '#modules/ticket/ticket.model.js';
import MembershipPayment from '#modules/parkingMembership/membershipPayment.model.js';
import { ApiError } from '#utils/ApiError.js';
import { auditService } from '#services/audit/audit.service.js';
import { paymentMethodConfigService } from '#services/payment/paymentMethodConfig.service.js';
import {
  PAYMENT_STATUS,
  PAYMENT_KIND,
  PAYMENT_AUDIT_ACTIONS,
  MEMBERSHIP_METHOD_CODE,
} from './constants.js';

/**
 * Servicio de pagos — cobros, pagos mixtos y reversos.
 */
export class PaymentService {
  async listByTicket(organizationId, ticketId) {
    const payments = await Payment.find({
      organizationId,
      ticketId,
      kind: PAYMENT_KIND.CHARGE,
    })
      .sort({ paidAt: 1 })
      .lean();

    return payments.map((p) => this.#formatPayment(p));
  }

  async listByCashRegister(organizationId, cashRegisterId) {
    const payments = await Payment.find({
      organizationId,
      cashRegisterId,
      status: PAYMENT_STATUS.COMPLETED,
      kind: PAYMENT_KIND.CHARGE,
    })
      .sort({ paidAt: -1 })
      .lean();

    return payments.map((p) => this.#formatPayment(p));
  }

  /**
   * Historial unificado: cobros de tickets + pagos de membresía.
   */
  async listHistory(organizationId, { page = 1, limit = 20, source = 'all' } = {}) {
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const wantTickets = source === 'all' || source === 'tickets';
    const wantMemberships = source === 'all' || source === 'memberships';

    const [ticketPayments, membershipPayments] = await Promise.all([
      wantTickets
        ? Payment.find({
            organizationId,
            kind: PAYMENT_KIND.CHARGE,
          })
            .populate('userId', 'firstName lastName')
            .populate({
              path: 'ticketId',
              select: 'vehicleId entryAt exitAt',
              populate: { path: 'vehicleId', select: 'plate' },
            })
            .sort({ paidAt: -1 })
            .limit(200)
            .lean()
        : [],
      wantMemberships
        ? MembershipPayment.find({ organizationId })
            .populate('memberId', 'name')
            .populate('vehicleId', 'plate')
            .populate('receivedByUserId', 'firstName lastName')
            .sort({ paidAt: -1 })
            .limit(200)
            .lean()
        : [],
    ]);

    const merged = [
      ...ticketPayments.map((p) => ({
        id: p._id,
        source: 'ticket',
        paidAt: p.paidAt,
        amount: p.amount,
        method: p.method,
        status: p.status,
        plate: p.ticketId?.vehicleId?.plate ?? null,
        memberName: null,
        receivedBy:
          p.userId != null
            ? `${p.userId.firstName ?? ''} ${p.userId.lastName ?? ''}`.trim()
            : null,
        reference: p.reference,
        notes: null,
      })),
      ...membershipPayments.map((p) => ({
        id: p._id,
        source: 'membership',
        paidAt: p.paidAt,
        amount: p.amount,
        method: p.method,
        status: 'completed',
        plate: p.vehicleId?.plate ?? null,
        memberName: p.memberId?.name ?? null,
        receivedBy:
          p.receivedByUserId != null
            ? `${p.receivedByUserId.firstName ?? ''} ${p.receivedByUserId.lastName ?? ''}`.trim()
            : null,
        reference: null,
        notes: p.notes,
        kind: p.kind,
      })),
    ].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

    const total = merged.length;
    const items = merged.slice(skip, skip + take);

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

  /**
   * Registra cobros de un ticket y valida montos/métodos.
   */
  async collectForTicket(
    organizationId,
    userId,
    cashRegisterId,
    ticketId,
    ticketTotal,
    { payments = [], coveredByMembership = false },
    auditContext = {},
  ) {
    const normalizedPayments = this.#normalizePaymentsInput(
      ticketTotal,
      payments,
      coveredByMembership,
    );

    await this.#validatePaymentSum(ticketTotal, normalizedPayments);

    for (const item of normalizedPayments) {
      await paymentMethodConfigService.assertMethodAllowed(organizationId, item.method, {
        allowMembership: coveredByMembership,
      });
    }

    const created = await Payment.insertMany(
      normalizedPayments.map((item) => ({
        organizationId,
        ticketId,
        userId,
        cashRegisterId,
        amount: item.amount,
        method: item.method,
        reference: item.reference ?? null,
        kind: PAYMENT_KIND.CHARGE,
        status: PAYMENT_STATUS.COMPLETED,
        paidAt: new Date(),
      })),
    );

    for (const payment of created) {
      await auditService.log({
        userId,
        organizationId,
        module: 'payment',
        action: PAYMENT_AUDIT_ACTIONS.CREATED,
        description: 'Pago registrado',
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        resourceId: payment._id,
        metadata: {
          ticketId,
          amount: payment.amount,
          method: payment.method,
          cashRegisterId,
        },
      });
    }

    return created.map((p) => this.#formatPayment(p.toObject()));
  }

  async reversePayment(organizationId, userId, paymentId, reason, auditContext = {}) {
    if (!reason?.trim()) {
      throw new ApiError(400, 'El motivo del reverso es obligatorio');
    }

    const original = await Payment.findOne({
      _id: paymentId,
      organizationId,
      kind: PAYMENT_KIND.CHARGE,
      status: PAYMENT_STATUS.COMPLETED,
    });

    if (!original) {
      throw new ApiError(404, 'Pago no encontrado o no reversible');
    }

    const existingReversal = await Payment.findOne({
      organizationId,
      reversalOfId: original._id,
      kind: PAYMENT_KIND.REVERSAL,
    });

    if (existingReversal) {
      throw new ApiError(409, 'Este pago ya fue revertido');
    }

    const ticket = await Ticket.findOne({
      _id: original.ticketId,
      organizationId,
    });

    if (!ticket) {
      throw new ApiError(404, 'Ticket asociado no encontrado');
    }

    const [reversal] = await Payment.create([
      {
        organizationId,
        ticketId: original.ticketId,
        userId,
        cashRegisterId: original.cashRegisterId,
        amount: original.amount,
        method: original.method,
        kind: PAYMENT_KIND.REVERSAL,
        status: PAYMENT_STATUS.COMPLETED,
        reversalOfId: original._id,
        reversalReason: reason.trim(),
        paidAt: new Date(),
      },
    ]);

    original.status = PAYMENT_STATUS.REFUNDED;
    await original.save();

    await auditService.log({
      userId,
      organizationId,
      module: 'payment',
      action: PAYMENT_AUDIT_ACTIONS.REVERSED,
      description: 'Reverso de pago registrado',
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      resourceId: reversal._id,
      metadata: {
        originalPaymentId: original._id,
        reason: reason.trim(),
        amount: original.amount,
        method: original.method,
      },
    });

    return {
      reversal: this.#formatPayment(reversal.toObject()),
      original: this.#formatPayment(original.toObject()),
    };
  }

  async aggregateForCashRegister(organizationId, cashRegisterId) {
    const payments = await Payment.find({
      organizationId,
      cashRegisterId,
      kind: PAYMENT_KIND.CHARGE,
      status: PAYMENT_STATUS.COMPLETED,
    }).lean();

    const totalsByMethod = {};
    let totalCollected = 0;
    const ticketIds = new Set();

    for (const payment of payments) {
      totalsByMethod[payment.method] = (totalsByMethod[payment.method] ?? 0) + payment.amount;
      totalCollected += payment.amount;
      ticketIds.add(payment.ticketId.toString());
    }

    const tickets = await Ticket.find({
      organizationId,
      _id: { $in: [...ticketIds] },
      status: 'closed',
    })
      .select('total coveredByMembership')
      .lean();

    let ticketsMembership = 0;
    let ticketsFree = 0;
    let ticketsPaid = 0;

    for (const ticket of tickets) {
      if (ticket.coveredByMembership) {
        ticketsMembership += 1;
      } else if (ticket.total === 0) {
        ticketsFree += 1;
      } else {
        ticketsPaid += 1;
      }
    }

    const incomeByHourMap = new Map();
    for (const payment of payments) {
      const hour = new Date(payment.paidAt).toISOString().slice(11, 13);
      incomeByHourMap.set(hour, (incomeByHourMap.get(hour) ?? 0) + payment.amount);
    }

    const incomeByHour = [...incomeByHourMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, total]) => ({ hour, total }));

    return {
      totalCollected,
      totalsByMethod,
      ticketsPaid,
      ticketsMembership,
      ticketsFree,
      ticketsClosed: tickets.length,
      incomeByHour,
      paymentsCount: payments.length,
    };
  }

  #normalizePaymentsInput(ticketTotal, payments, coveredByMembership) {
    if (coveredByMembership) {
      return [{ method: MEMBERSHIP_METHOD_CODE, amount: 0 }];
    }

    if (ticketTotal === 0) {
      return [{ method: 'other', amount: 0 }];
    }

    if (!Array.isArray(payments) || payments.length === 0) {
      throw new ApiError(400, 'Debe indicar al menos un método de pago');
    }

    return payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      reference: p.reference ?? null,
    }));
  }

  async #validatePaymentSum(ticketTotal, payments) {
    const sum = payments.reduce((acc, p) => acc + p.amount, 0);

    if (Math.abs(sum - ticketTotal) > 0.001) {
      await auditService.log({
        module: 'payment',
        action: PAYMENT_AUDIT_ACTIONS.COLLECT_FAILED,
        description: 'Intento de cobro con montos que no coinciden',
        metadata: { ticketTotal, sum, payments },
      });
      throw new ApiError(
        400,
        `La suma de pagos ($${sum}) no coincide con el total del ticket ($${ticketTotal})`,
      );
    }

    for (const item of payments) {
      if (item.amount < 0) {
        throw new ApiError(400, 'Los montos de pago no pueden ser negativos');
      }
      if (item.amount > 0 && item.amount < 0.01 && item.method !== MEMBERSHIP_METHOD_CODE) {
        throw new ApiError(400, 'Cada pago parcial debe ser al menos $0.01');
      }
    }
  }

  #formatPayment(payment) {
    return {
      id: payment._id,
      ticketId: payment.ticketId,
      cashRegisterId: payment.cashRegisterId,
      userId: payment.userId,
      amount: payment.amount,
      method: payment.method,
      kind: payment.kind,
      status: payment.status,
      reference: payment.reference,
      reversalOfId: payment.reversalOfId,
      reversalReason: payment.reversalReason,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

export const paymentService = new PaymentService();
