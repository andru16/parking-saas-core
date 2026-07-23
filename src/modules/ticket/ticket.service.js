import Ticket from './ticket.model.js';
import VehicleCategory from '#modules/vehicleCategory/vehicleCategory.model.js';
import { ApiError } from '#utils/ApiError.js';
import { resolveCategoryFromPlate, normalizePlate } from '#utils/colombianPlate.js';
import { auditService } from '#services/audit/audit.service.js';
import { cashRegisterService } from '#modules/cashRegister/cashRegister.service.js';
import { paymentService } from '#modules/payment/payment.service.js';
import { parkingMembershipQueryService } from '#services/membership/parkingMembershipQuery.service.js';
import { rateResolverService } from '#services/rate/rateResolver.service.js';
import { rateCalculatorService } from '#services/rate/rateCalculator.service.js';
import { vehicleService } from '#services/vehicle/vehicle.service.js';
import { planLimitsService } from '#services/saas-billing/planLimits.service.js';
import { TICKET_STATUS, TICKET_AUDIT_ACTIONS } from './constants.js';

const TICKET_POPULATE = [
  { path: 'vehicleId', select: 'plate memberId vehicleCategoryId status' },
  { path: 'vehicleCategoryId', select: 'name color icon' },
  { path: 'memberId', select: 'name memberType' },
  { path: 'parkingMembershipId', select: 'name endDate status' },
  { path: 'entryUserId', select: 'firstName lastName' },
  { path: 'exitUserId', select: 'firstName lastName' },
  {
    path: 'cashRegisterId',
    select: 'status openedAt cashPointId',
    populate: { path: 'cashPointId', select: 'name' },
  },
];

/**
 * Servicio de tickets — lógica del Centro de Operaciones.
 */
export class TicketService {
  async listVehicleCategories(organizationId) {
    const categories = await VehicleCategory.find({
      organizationId,
      isDeleted: false,
      isActive: true,
    })
      .sort({ displayOrder: 1, name: 1 })
      .select('name color icon requirements displayOrder')
      .lean();

    return categories.map((c) => ({
      id: c._id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      requirements: c.requirements,
    }));
  }

  /**
   * Búsqueda instantánea por placa (índice unique_plate_per_org).
   */
  async lookupByPlate(organizationId, plate) {
    const vehicle = await vehicleService.findByPlate(organizationId, plate);

    if (!vehicle) {
      return {
        found: false,
        vehicle: null,
        openTicket: null,
        activeMembership: null,
      };
    }

    const [openTicket, activeMembership] = await Promise.all([
      this.#findOpenTicketForVehicle(organizationId, vehicle._id),
      parkingMembershipQueryService.findActiveForVehicle(organizationId, vehicle._id),
    ]);

    return {
      found: true,
      vehicle: this.#formatVehicle(vehicle),
      openTicket: openTicket ? this.#formatTicket(openTicket) : null,
      activeMembership: activeMembership ? this.#formatMembership(activeMembership) : null,
    };
  }

  async listOpenTickets(organizationId) {
    const tickets = await Ticket.find({
      organizationId,
      status: TICKET_STATUS.OPEN,
    })
      .sort({ entryAt: -1 })
      .populate(TICKET_POPULATE)
      .lean();

    return tickets.map((t) => this.#formatTicket(t));
  }

  async getById(organizationId, ticketId) {
    const ticket = await Ticket.findOne({ _id: ticketId, organizationId })
      .populate(TICKET_POPULATE)
      .lean();

    if (!ticket) {
      throw new ApiError(404, 'Ticket no encontrado');
    }

    return this.#formatTicket(ticket);
  }

  /**
   * Historial de tickets del mismo vehículo (últimos N).
   */
  async getVehicleHistory(organizationId, ticketId, limit = 10) {
    const ticket = await Ticket.findOne({ _id: ticketId, organizationId })
      .select('vehicleId')
      .lean();

    if (!ticket) {
      throw new ApiError(404, 'Ticket no encontrado');
    }

    const history = await Ticket.find({
      organizationId,
      vehicleId: ticket.vehicleId,
    })
      .sort({ entryAt: -1 })
      .limit(Math.min(limit, 50))
      .populate(TICKET_POPULATE)
      .lean();

    return history.map((t) => this.#formatTicket(t));
  }

  /**
   * Cancela un ticket abierto sin cobro (admin/supervisor vía authorize en ruta).
   */
  async cancelTicket(organizationId, userId, ticketId, reason, auditContext = {}) {
    const ticket = await Ticket.findOne({ _id: ticketId, organizationId });

    if (!ticket) {
      throw new ApiError(404, 'Ticket no encontrado');
    }

    if (ticket.status === TICKET_STATUS.CLOSED) {
      throw new ApiError(409, 'El ticket ya está cerrado y cobrado');
    }

    if (ticket.status === TICKET_STATUS.CANCELLED) {
      throw new ApiError(409, 'El ticket ya está cancelado');
    }

    ticket.status = TICKET_STATUS.CANCELLED;
    ticket.exitAt = new Date();
    ticket.exitUserId = userId;
    ticket.notes = [ticket.notes, reason ? `Cancelación: ${reason}` : 'Cancelado']
      .filter(Boolean)
      .join(' | ');
    await ticket.save();

    await auditService.log({
      userId,
      organizationId,
      module: 'ticket',
      action: TICKET_AUDIT_ACTIONS.CANCELLED,
      description: 'Ticket cancelado',
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      resourceId: ticket._id,
      metadata: { reason: reason ?? null },
    });

    return this.getById(organizationId, ticket._id);
  }

  /**
   * Apertura de ticket — ingreso de vehículo.
   */
  async openEntry(organizationId, userId, payload, auditContext = {}) {
    await planLimitsService.assertTicketCapacity(organizationId);

    const cashRegister = await cashRegisterService.assertOpenSession(organizationId, userId);

    let vehicle = null;
    let vehicleAutoRegistered = false;

    if (payload.plate) {
      vehicle = await vehicleService.findByPlate(organizationId, payload.plate);
    }

    if (!vehicle && payload.vehicleId) {
      const Vehicle = (await import('#modules/vehicle/vehicle.model.js')).default;
      vehicle = await Vehicle.findOne({
        _id: payload.vehicleId,
        organizationId,
        status: 'active',
      })
        .populate('vehicleCategoryId', 'name color icon requirements')
        .lean();
    }

    if (!vehicle) {
      let categoryId = payload.vehicleCategoryId;

      if (!categoryId && payload.plate) {
        const activeCategories = await VehicleCategory.find({
          organizationId,
          isActive: true,
        })
          .select('name icon')
          .lean();

        const resolved = resolveCategoryFromPlate(payload.plate, activeCategories);
        if (resolved.message && resolved.reason === 'plate_kind_mismatch') {
          throw new ApiError(400, resolved.message);
        }
        if (resolved.categoryId) {
          categoryId = resolved.categoryId;
        }
      }

      if (!categoryId) {
        throw new ApiError(400, 'Seleccione la categoría del vehículo para registrar el ingreso');
      }

      vehicle = await vehicleService.quickRegister(organizationId, {
        plate: payload.plate ? normalizePlate(payload.plate) : payload.plate,
        vehicleCategoryId: categoryId,
        notes: payload.notes,
      });
      vehicleAutoRegistered = true;

      await auditService.log({
        userId,
        organizationId,
        module: 'ticket',
        action: TICKET_AUDIT_ACTIONS.VEHICLE_AUTO_REGISTERED,
        description: 'Vehículo registrado automáticamente en ingreso',
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        resourceId: vehicle._id,
        metadata: { plate: vehicle.plate, vehicleCategoryId: vehicle.vehicleCategoryId },
      });
    }

    const openTicket = await this.#findOpenTicketForVehicle(organizationId, vehicle._id);
    if (openTicket) {
      await auditService.log({
        userId,
        organizationId,
        module: 'ticket',
        action: TICKET_AUDIT_ACTIONS.OPEN_FAILED,
        description: 'Intento de ingreso con ticket ya abierto',
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        resourceId: openTicket._id,
        metadata: { vehicleId: vehicle._id },
      });
      throw new ApiError(409, 'El vehículo ya tiene un ticket abierto');
    }

    const categoryId = vehicle.vehicleCategoryId._id ?? vehicle.vehicleCategoryId;
    const { rateId, rateSnapshot } = await rateResolverService.resolveForCategory(
      organizationId,
      categoryId,
    );

    const activeMembership = await parkingMembershipQueryService.findActiveForVehicle(
      organizationId,
      vehicle._id,
    );

    const entryAt = new Date();

    const [ticket] = await Ticket.create([
      {
        organizationId,
        vehicleId: vehicle._id,
        vehicleCategoryId: categoryId,
        memberId: vehicle.memberId ?? null,
        rateId,
        rateSnapshot,
        cashRegisterId: cashRegister._id,
        entryAt,
        status: TICKET_STATUS.OPEN,
        entryUserId: userId,
        parkingMembershipId: activeMembership?._id ?? null,
        coveredByMembership: Boolean(activeMembership),
        entrySource: payload.entrySource ?? 'manual',
        externalReference: payload.externalReference ?? null,
        notes: payload.notes ?? null,
        total: 0,
      },
    ]);

    await auditService.log({
      userId,
      organizationId,
      module: 'ticket',
      action: TICKET_AUDIT_ACTIONS.OPENED,
      description: 'Ticket abierto — ingreso de vehículo',
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      resourceId: ticket._id,
      metadata: {
        vehicleId: vehicle._id,
        plate: vehicle.plate,
        vehicleAutoRegistered,
      },
    });

    return this.getById(organizationId, ticket._id);
  }

  /**
   * Vista previa de salida — calcula total sin cerrar el ticket.
   */
  async getExitPreview(organizationId, ticketId) {
    const ticket = await Ticket.findOne({ _id: ticketId, organizationId });

    if (!ticket) {
      throw new ApiError(404, 'Ticket no encontrado');
    }

    if (ticket.status !== TICKET_STATUS.OPEN) {
      throw new ApiError(409, 'El ticket no está abierto');
    }

    return this.#computeExitAmounts(organizationId, ticket);
  }

  /**
   * Cobro y cierre de ticket — salida con pago(s).
   */
  async collectAndClose(organizationId, userId, ticketId, payload = {}, auditContext = {}) {
    const cashRegister = await cashRegisterService.assertOpenSession(organizationId, userId);

    const ticket = await Ticket.findOne({ _id: ticketId, organizationId });

    if (!ticket) {
      throw new ApiError(404, 'Ticket no encontrado');
    }

    if (ticket.status === TICKET_STATUS.CLOSED) {
      throw new ApiError(409, 'El ticket ya está cerrado y cobrado');
    }

    if (ticket.status === TICKET_STATUS.CANCELLED) {
      throw new ApiError(409, 'El ticket está cancelado');
    }

    const amounts = await this.#computeExitAmounts(organizationId, ticket);
    const exitAt = new Date();

    const payments = await paymentService.collectForTicket(
      organizationId,
      userId,
      cashRegister._id,
      ticket._id,
      amounts.total,
      {
        payments: payload.payments ?? [],
        coveredByMembership: amounts.coveredByMembership,
      },
      auditContext,
    );

    ticket.exitAt = exitAt;
    ticket.durationMinutes = amounts.durationMinutes;
    ticket.total = amounts.total;
    ticket.calculationBreakdown = amounts.calculationBreakdown;
    ticket.coveredByMembership = amounts.coveredByMembership;
    ticket.parkingMembershipId = amounts.parkingMembershipId;
    ticket.status = TICKET_STATUS.CLOSED;
    ticket.exitUserId = userId;
    await ticket.save();

    if (amounts.coveredByMembership && amounts.parkingMembershipId) {
      const { parkingMembershipsService } = await import(
        '#modules/parkingMembership/parkingMemberships.service.js'
      );
      await parkingMembershipsService.recordUsage(organizationId, amounts.parkingMembershipId);
    }

    await auditService.log({
      userId,
      organizationId,
      module: 'ticket',
      action: TICKET_AUDIT_ACTIONS.COLLECTED,
      description: 'Ticket cobrado y cerrado',
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      resourceId: ticket._id,
      metadata: {
        total: amounts.total,
        coveredByMembership: amounts.coveredByMembership,
        paymentsCount: payments.length,
      },
    });

    await auditService.log({
      userId,
      organizationId,
      module: 'ticket',
      action: TICKET_AUDIT_ACTIONS.CLOSED,
      description: 'Ticket cerrado — salida de vehículo',
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      resourceId: ticket._id,
      metadata: {
        total: amounts.total,
        durationMinutes: amounts.durationMinutes,
        coveredByMembership: amounts.coveredByMembership,
      },
    });

    const formatted = await this.getById(organizationId, ticket._id);
    return { ticket: formatted, payments, preview: amounts };
  }

  /**
   * @deprecated Usar collectAndClose. Mantenido por compatibilidad interna.
   */
  async closeExit(organizationId, userId, ticketId, auditContext = {}) {
    return this.collectAndClose(organizationId, userId, ticketId, { payments: [] }, auditContext);
  }

  async #computeExitAmounts(organizationId, ticket) {
    const exitAt = new Date();
    const durationMinutes = Math.max(
      0,
      Math.floor((exitAt.getTime() - ticket.entryAt.getTime()) / 60_000),
    );

    const activeMembership = await parkingMembershipQueryService.findActiveForVehicle(
      organizationId,
      ticket.vehicleId,
      exitAt,
    );

    let total = 0;
    let calculationBreakdown = null;
    let coveredByMembership = false;
    let parkingMembershipId = null;

    if (activeMembership) {
      coveredByMembership = true;
      parkingMembershipId = activeMembership._id;
      calculationBreakdown = {
        durationMinutes,
        reason: 'covered_by_membership',
        membershipId: activeMembership._id,
        membershipName: activeMembership.name,
      };
    } else if (ticket.rateSnapshot) {
      const { settingsService } = await import('#modules/systemSettings/settings.service.js');
      const graceMinutes = await settingsService.getOrgGraceMinutes(organizationId);
      const result = rateCalculatorService.calculate(
        ticket.rateSnapshot,
        durationMinutes,
        graceMinutes,
      );
      total = result.total;
      calculationBreakdown = result.breakdown;
    }

    return {
      exitAt,
      durationMinutes,
      total,
      calculationBreakdown,
      coveredByMembership,
      parkingMembershipId,
      rateSnapshot: ticket.rateSnapshot
        ? {
            name: ticket.rateSnapshot.name ?? null,
            billingMode: ticket.rateSnapshot.billingMode ?? null,
            value: ticket.rateSnapshot.value ?? null,
          }
        : null,
      membership: activeMembership
        ? {
            id: activeMembership._id,
            name: activeMembership.name,
            endDate: activeMembership.endDate,
          }
        : null,
      requiresPayment: !coveredByMembership && total > 0,
    };
  }

  async #findOpenTicketForVehicle(organizationId, vehicleId) {
    return Ticket.findOne({
      organizationId,
      vehicleId,
      status: TICKET_STATUS.OPEN,
    }).lean();
  }

  #formatVehicle(vehicle) {
    const category = vehicle.vehicleCategoryId;
    return {
      id: vehicle._id,
      plate: vehicle.plate,
      memberId: vehicle.memberId,
      status: vehicle.status,
      category: category
        ? {
            id: category._id ?? category,
            name: category.name,
            color: category.color,
            icon: category.icon,
            requirements: category.requirements,
          }
        : null,
    };
  }

  #formatMembership(membership) {
    return {
      id: membership._id,
      name: membership.name,
      status: membership.status,
      startDate: membership.startDate,
      endDate: membership.endDate,
    };
  }

  #formatTicket(ticket) {
    const vehicle = ticket.vehicleId;
    const category = ticket.vehicleCategoryId;

    return {
      id: ticket._id,
      status: ticket.status,
      entryAt: ticket.entryAt,
      exitAt: ticket.exitAt,
      durationMinutes: ticket.durationMinutes,
      total: ticket.total,
      coveredByMembership: ticket.coveredByMembership,
      calculationBreakdown: ticket.calculationBreakdown,
      notes: ticket.notes,
      entrySource: ticket.entrySource,
      vehicle: vehicle
        ? {
            id: vehicle._id ?? vehicle,
            plate: vehicle.plate,
            memberId: vehicle.memberId,
          }
        : null,
      category: category
        ? {
            id: category._id ?? category,
            name: category.name,
            color: category.color,
            icon: category.icon,
          }
        : null,
      member: ticket.memberId
        ? {
            id: ticket.memberId._id ?? ticket.memberId,
            name: ticket.memberId.name,
            memberType: ticket.memberId.memberType,
          }
        : null,
      membership: ticket.parkingMembershipId
        ? {
            id: ticket.parkingMembershipId._id ?? ticket.parkingMembershipId,
            name: ticket.parkingMembershipId.name,
            endDate: ticket.parkingMembershipId.endDate,
          }
        : null,
      entryUser: ticket.entryUserId
        ? {
            id: ticket.entryUserId._id ?? ticket.entryUserId,
            firstName: ticket.entryUserId.firstName,
            lastName: ticket.entryUserId.lastName,
          }
        : null,
      exitUser: ticket.exitUserId
        ? {
            id: ticket.exitUserId._id ?? ticket.exitUserId,
            firstName: ticket.exitUserId.firstName,
            lastName: ticket.exitUserId.lastName,
          }
        : null,
      cashRegister: ticket.cashRegisterId
        ? {
            id: ticket.cashRegisterId._id ?? ticket.cashRegisterId,
            status: ticket.cashRegisterId.status ?? null,
            openedAt: ticket.cashRegisterId.openedAt ?? null,
            cashPointName: ticket.cashRegisterId.cashPointId?.name ?? null,
          }
        : null,
      rateSnapshot: ticket.rateSnapshot,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }
}

export const ticketService = new TicketService();
