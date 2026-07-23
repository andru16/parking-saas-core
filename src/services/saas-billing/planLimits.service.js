import User from '#modules/user/user.model.js';
import CashPoint from '#modules/cashPoint/cashPoint.model.js';
import Ticket from '#modules/ticket/ticket.model.js';
import { ApiError } from '#utils/ApiError.js';
import { subscriptionService } from './subscription.service.js';

const LIMIT_LABELS = Object.freeze({
  maxUsers: 'usuarios',
  maxCashRegisters: 'cajas',
  maxSites: 'sedes',
  maxActiveVehicles: 'vehículos activos en el parqueadero',
  maxDailyTickets: 'tickets diarios',
});

const FEATURE_LABELS = Object.freeze({
  memberships: 'membresías',
  agreements: 'convenios',
  reports_advanced: 'reportes avanzados',
  export_excel: 'exportación a Excel',
  export_pdf: 'exportación a PDF',
  audit: 'auditoría',
  multi_site: 'multi-sede',
  api: 'API',
  integrations: 'integraciones',
  notifications: 'notificaciones',
  reports: 'reportes',
});

/**
 * Límites y features del plan de la organización.
 * `null` en un límite = ilimitado. `features === null` = sin plan (no se bloquea).
 */
export class PlanLimitsService {
  async getContext(organizationId) {
    const summary = await subscriptionService.getSummaryForOrganization(organizationId);
    if (!summary?.plan) {
      return {
        plan: null,
        features: null,
        limits: {},
        status: summary?.status ?? null,
        accessMode: summary?.accessMode ?? 'none',
      };
    }

    return {
      plan: summary.plan,
      features: summary.plan.features ?? {},
      limits: summary.plan.limits ?? {},
      status: summary.status,
      accessMode: summary.accessMode,
    };
  }

  async getUsage(organizationId) {
    const [users, cashRegisters, openTickets, dailyTickets] = await Promise.all([
      User.countDocuments({ organizationId }),
      CashPoint.countDocuments({ organizationId }),
      Ticket.countDocuments({ organizationId, status: 'open' }),
      Ticket.countDocuments({
        organizationId,
        entryAt: { $gte: this.#startOfUtcDay() },
      }),
    ]);

    let sites = 0;
    try {
      const Site = (await import('#modules/site/site.model.js')).default;
      sites = await Site.countDocuments({ organizationId });
    } catch {
      sites = 0;
    }

    return {
      users,
      cashRegisters,
      sites,
      activeVehicles: openTickets,
      dailyTickets,
    };
  }

  async assertFeature(organizationId, featureKey, customMessage) {
    const { features } = await this.getContext(organizationId);
    if (features == null) return;
    if (features[featureKey] === true) return;

    const label = FEATURE_LABELS[featureKey] ?? featureKey;
    throw new ApiError(
      403,
      customMessage ??
        `Su plan actual no incluye ${label}. Actualice su suscripción para habilitarlo.`,
    );
  }

  hasFeature(features, featureKey) {
    if (features == null) return true;
    return features[featureKey] === true;
  }

  /**
   * Valida que `proposedCount` no exceda el límite del plan.
   */
  async assertMaxCount(organizationId, limitKey, proposedCount, customMessage) {
    const { limits } = await this.getContext(organizationId);
    const max = limits?.[limitKey];
    if (max == null) return;

    if (Number(proposedCount) > Number(max)) {
      const label = LIMIT_LABELS[limitKey] ?? limitKey;
      throw new ApiError(
        403,
        customMessage ??
          `Su plan permite hasta ${max} ${label}. Actualice su suscripción para ampliar el cupo.`,
      );
    }
  }

  async assertCanAddUser(organizationId) {
    const count = await User.countDocuments({ organizationId });
    await this.assertMaxCount(organizationId, 'maxUsers', count + 1);
  }

  async assertCashRegisterCount(organizationId, proposedCount) {
    await this.assertMaxCount(organizationId, 'maxCashRegisters', proposedCount);
  }

  /**
   * Crear una sede adicional (no la primaria).
   * Requiere feature multi_site + cupo maxSites.
   */
  async assertCanAddSite(organizationId) {
    await this.assertFeature(
      organizationId,
      'multi_site',
      'Su plan no incluye multi-sede. Actualice a Enterprise para gestionar varias sedes.',
    );

    const Site = (await import('#modules/site/site.model.js')).default;
    const count = await Site.countDocuments({ organizationId });
    await this.assertMaxCount(organizationId, 'maxSites', count + 1);
  }

  async assertTicketCapacity(organizationId) {
    const { limits } = await this.getContext(organizationId);

    if (limits.maxActiveVehicles != null) {
      const open = await Ticket.countDocuments({ organizationId, status: 'open' });
      if (open >= limits.maxActiveVehicles) {
        throw new ApiError(
          403,
          `Su plan permite hasta ${limits.maxActiveVehicles} vehículos activos a la vez. Actualice su suscripción o cierre tickets abiertos.`,
        );
      }
    }

    if (limits.maxDailyTickets != null) {
      const daily = await Ticket.countDocuments({
        organizationId,
        entryAt: { $gte: this.#startOfUtcDay() },
      });
      if (daily >= limits.maxDailyTickets) {
        throw new ApiError(
          403,
          `Su plan permite hasta ${limits.maxDailyTickets} tickets por día. Actualice su suscripción para continuar.`,
        );
      }
    }
  }

  #startOfUtcDay() {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}

export const planLimitsService = new PlanLimitsService();
