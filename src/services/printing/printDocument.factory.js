import Payment from '#modules/payment/payment.model.js';
import Ticket from '#modules/ticket/ticket.model.js';
import CashRegister from '#modules/cashRegister/cashRegister.model.js';
import ParkingMembership from '#modules/parkingMembership/parkingMembership.model.js';
import { ApiError } from '#utils/ApiError.js';
import {
  PRINT_DOCUMENT_TYPES,
  normalizeDocumentType,
} from './constants.js';
import { printSettingsService } from './printSettings.service.js';
import { renderTemplate } from './templates/index.js';

const TICKET_POPULATE = [
  { path: 'vehicleId', select: 'plate memberId' },
  { path: 'vehicleCategoryId', select: 'name color icon' },
  { path: 'memberId', select: 'name memberType' },
  { path: 'parkingMembershipId', select: 'name endDate' },
  { path: 'entryUserId', select: 'firstName lastName' },
  { path: 'exitUserId', select: 'firstName lastName' },
  {
    path: 'cashRegisterId',
    select: 'status openedAt cashPointId',
    populate: { path: 'cashPointId', select: 'name' },
  },
];

const CASH_POPULATE = [
  { path: 'userId', select: 'firstName lastName' },
  { path: 'cashPointId', select: 'name code' },
];

const MEMBERSHIP_POPULATE = [
  { path: 'memberId', select: 'name memberType documentNumber' },
  { path: 'vehicleId', select: 'plate' },
];

/**
 * Carga datos de dominio y aplica plantillas.
 * Sin HTML: el render lo hacen los adapters.
 */
export class PrintDocumentFactory {
  async buildTicket(organizationId, ticketId, typeHint = 'auto') {
    const ticket = await Ticket.findOne({ _id: ticketId, organizationId })
      .populate(TICKET_POPULATE)
      .lean();

    if (!ticket) throw new ApiError(404, 'Ticket no encontrado');

    const type = this.#resolveTicketType(ticket, typeHint);
    const configBundle = await printSettingsService.getConfig(organizationId);
    const payments =
      type === PRINT_DOCUMENT_TYPES.TICKET_EXIT
        ? await Payment.find({
            organizationId,
            ticketId: ticket._id,
            status: 'completed',
            kind: { $ne: 'reversal' },
          })
            .sort({ paidAt: 1 })
            .lean()
        : [];

    return renderTemplate(type, { ticket, payments, configBundle });
  }

  async buildCash(organizationId, cashRegisterId, type, summary = null) {
    const session = await CashRegister.findOne({ _id: cashRegisterId, organizationId })
      .populate(CASH_POPULATE)
      .lean();

    if (!session) throw new ApiError(404, 'Sesión de caja no encontrada');

    const configBundle = await printSettingsService.getConfig(organizationId);
    const docType = normalizeDocumentType(type);

    return renderTemplate(docType, { session, summary, configBundle });
  }

  async buildMembership(organizationId, membershipId, type, operator = null) {
    const membership = await ParkingMembership.findOne({
      _id: membershipId,
      organizationId,
    })
      .populate(MEMBERSHIP_POPULATE)
      .lean();

    if (!membership) throw new ApiError(404, 'Membresía no encontrada');

    const configBundle = await printSettingsService.getConfig(organizationId);
    return renderTemplate(normalizeDocumentType(type), {
      membership,
      operator,
      configBundle,
    });
  }

  async buildPaymentReceipt(organizationId, paymentId) {
    const payment = await Payment.findOne({ _id: paymentId, organizationId }).lean();
    if (!payment) throw new ApiError(404, 'Pago no encontrado');
    if (!payment.ticketId) {
      throw new ApiError(400, 'El pago no está asociado a un ticket imprimible');
    }
    return this.buildTicket(organizationId, payment.ticketId, PRINT_DOCUMENT_TYPES.TICKET_EXIT);
  }

  async buildPreview(organizationId, { type = 'entry', draft } = {}) {
    const base = await printSettingsService.getConfig(organizationId);
    const configBundle = draft ? printSettingsService.mergeDraft(base, draft) : base;
    const docType = normalizeDocumentType(type);

    if (
      docType === PRINT_DOCUMENT_TYPES.TICKET_ENTRY ||
      docType === PRINT_DOCUMENT_TYPES.TICKET_EXIT ||
      docType === PRINT_DOCUMENT_TYPES.PAYMENT_RECEIPT
    ) {
      const sample = this.#sampleTicket(
        docType === PRINT_DOCUMENT_TYPES.TICKET_ENTRY
          ? PRINT_DOCUMENT_TYPES.TICKET_ENTRY
          : PRINT_DOCUMENT_TYPES.TICKET_EXIT,
      );
      return renderTemplate(
        docType === PRINT_DOCUMENT_TYPES.PAYMENT_RECEIPT
          ? PRINT_DOCUMENT_TYPES.TICKET_EXIT
          : docType,
        {
          ticket: sample.ticket,
          payments: sample.payments,
          configBundle,
          isPreview: true,
        },
      );
    }

    if (
      docType === PRINT_DOCUMENT_TYPES.CASH_OPEN ||
      docType === PRINT_DOCUMENT_TYPES.CASH_CLOSE ||
      docType === PRINT_DOCUMENT_TYPES.CASH_AUDIT
    ) {
      return renderTemplate(docType, {
        session: this.#sampleCash(docType),
        summary: this.#sampleCashSummary(),
        configBundle,
        isPreview: true,
      });
    }

    if (
      docType === PRINT_DOCUMENT_TYPES.MEMBERSHIP_PAYMENT ||
      docType === PRINT_DOCUMENT_TYPES.MEMBERSHIP_RENEWAL ||
      docType === PRINT_DOCUMENT_TYPES.MEMBERSHIP_NEW
    ) {
      return renderTemplate(docType, {
        membership: this.#sampleMembership(),
        operator: { firstName: 'Admin', lastName: 'Demo' },
        configBundle,
        isPreview: true,
      });
    }

    throw new ApiError(400, `Tipo de vista previa no soportado: ${type}`);
  }

  #resolveTicketType(ticket, typeHint) {
    const hint = normalizeDocumentType(typeHint);
    if (
      hint === PRINT_DOCUMENT_TYPES.TICKET_ENTRY ||
      hint === PRINT_DOCUMENT_TYPES.TICKET_EXIT
    ) {
      return hint;
    }
    return ticket.status === 'closed'
      ? PRINT_DOCUMENT_TYPES.TICKET_EXIT
      : PRINT_DOCUMENT_TYPES.TICKET_ENTRY;
  }

  #sampleTicket(type) {
    const now = new Date();
    const entryAt = new Date(now.getTime() - 95 * 60 * 1000);
    const id = '0000000000000000preview';

    const ticket = {
      _id: id,
      status: type === PRINT_DOCUMENT_TYPES.TICKET_EXIT ? 'closed' : 'open',
      entryAt,
      exitAt: type === PRINT_DOCUMENT_TYPES.TICKET_EXIT ? now : null,
      durationMinutes: type === PRINT_DOCUMENT_TYPES.TICKET_EXIT ? 95 : null,
      total: type === PRINT_DOCUMENT_TYPES.TICKET_EXIT ? 4500 : 0,
      notes: type === PRINT_DOCUMENT_TYPES.TICKET_ENTRY ? 'Vista previa' : null,
      coveredByMembership: false,
      rateSnapshot: { name: 'Carro — Por hora', billingMode: 'per_hour', value: 3000 },
      calculationBreakdown: { discount: 500, change: 500 },
      vehicleId: { plate: 'ABC123' },
      vehicleCategoryId: { name: 'Carro' },
      entryUserId: { firstName: 'Operador', lastName: 'Demo' },
      exitUserId: { firstName: 'Cajero', lastName: 'Demo' },
      cashRegisterId: { cashPointName: 'Caja principal' },
    };

    const payments =
      type === PRINT_DOCUMENT_TYPES.TICKET_EXIT
        ? [{ method: 'cash', amount: 4500, status: 'completed' }]
        : [];

    return { ticket, payments };
  }

  #sampleCash(type) {
    const now = new Date();
    return {
      _id: '0000000000000000cashprev',
      status: type === PRINT_DOCUMENT_TYPES.CASH_OPEN ? 'open' : 'closed',
      openedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      closedAt: type === PRINT_DOCUMENT_TYPES.CASH_OPEN ? null : now,
      openingAmount: 100000,
      openingNotes: 'Fondo de apertura',
      closingAmount: 285000,
      calculatedAmount: 280000,
      difference: 5000,
      notes: 'Cierre demo',
      userId: { firstName: 'Cajero', lastName: 'Demo' },
      cashPointId: { name: 'Caja principal' },
      closingSummary: this.#sampleCashSummary(),
    };
  }

  #sampleCashSummary() {
    return {
      totalCollected: 180000,
      totalsByMethod: { cash: 120000, transfer: 40000, transfer: 20000 },
      ticketsPaid: 24,
      ticketsMembership: 3,
      ticketsFree: 1,
      ticketsClosed: 28,
    };
  }

  #sampleMembership() {
    const now = new Date();
    return {
      _id: '0000000000000000memprev',
      name: 'Mensual Carro',
      startDate: now,
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      amount: 120000,
      notes: null,
      memberId: { name: 'Cliente Demo' },
      vehicleId: { plate: 'XYZ789' },
    };
  }
}

export const printDocumentFactory = new PrintDocumentFactory();

/** @deprecated Compat con builder anterior */
export const ticketPrintDocumentBuilder = {
  buildFromTicket: (orgId, ticketId, type) =>
    printDocumentFactory.buildTicket(orgId, ticketId, type),
  buildPreview: (orgId, opts) => printDocumentFactory.buildPreview(orgId, opts),
};
