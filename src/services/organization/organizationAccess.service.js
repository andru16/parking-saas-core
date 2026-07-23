import Subscription, {
  OPERATIONAL_SUBSCRIPTION_STATUSES,
} from '#modules/subscription/subscription.model.js';
import Organization from '#modules/organization/organization.model.js';
import { ApiError } from '#utils/ApiError.js';
import { ROLES } from '#modules/auth/constants.js';

/** Orgs con acceso de escritura (operaciones). */
const WRITE_ORG_STATUSES = Object.freeze(['active', 'trial', 'pending_verification']);

/** Orgs que pueden iniciar sesión y consultar / exportar. */
const READ_ORG_STATUSES = Object.freeze([
  'active',
  'trial',
  'pending_verification',
  'suspended',
]);

/**
 * Valida acceso de una organización (estado + suscripción).
 * - write: operaciones (ingresos, cobros, usuarios, config)
 * - read: consulta, reportes, exportación, renovación
 */
export class OrganizationAccessService {
  async assertOrganizationExists(organizationId) {
    const organization = await Organization.findById(organizationId).select('_id name status');

    if (!organization) {
      throw new ApiError(403, 'La organización no existe');
    }

    return organization;
  }

  async assertOrganizationActive(organization) {
    if (!WRITE_ORG_STATUSES.includes(organization.status)) {
      if (organization.status === 'suspended') {
        throw new ApiError(
          403,
          'La organización está suspendida. Solo puedes consultar, exportar o renovar la suscripción.',
          { code: 'ORG_SUSPENDED', access: 'read_only' },
        );
      }

      throw new ApiError(403, 'La organización no está activa');
    }
  }

  async assertOrganizationReadable(organization) {
    if (!READ_ORG_STATUSES.includes(organization.status)) {
      throw new ApiError(403, 'La organización no está disponible');
    }
  }

  /**
   * Suscripción con acceso operativo completo (trial | active | grace_period).
   */
  async assertActiveSubscription(organizationId) {
    const subscription = await Subscription.findOne({
      organizationId,
      status: { $in: [...OPERATIONAL_SUBSCRIPTION_STATUSES] },
    })
      .sort({ endDate: -1 })
      .select('_id endDate planId status gracePeriodEndsAt');

    if (!subscription) {
      throw new ApiError(403, 'La suscripción no está vigente');
    }

    if (subscription.status === 'grace_period') {
      return subscription;
    }

    if (subscription.endDate && subscription.endDate < new Date()) {
      throw new ApiError(403, 'La suscripción no está vigente');
    }

    return subscription;
  }

  /**
   * Suscripción que permite login / lectura (incluye suspended/expired recientes).
   */
  async assertReadableSubscription(organizationId) {
    const subscription = await Subscription.findOne({
      organizationId,
      status: {
        $in: [
          ...OPERATIONAL_SUBSCRIPTION_STATUSES,
          'awaiting_activation',
          'suspended',
          'expired',
        ],
      },
    })
      .sort({ updatedAt: -1 })
      .select('_id endDate planId status gracePeriodEndsAt');

    if (!subscription) {
      // Orgs recién creadas sin sub aún: permitir lectura mínima
      return null;
    }

    return subscription;
  }

  /**
   * Acceso completo (escritura operativa).
   */
  async assertOperationalAccess(organizationId) {
    const organization = await this.assertOrganizationExists(organizationId);
    await this.assertOrganizationActive(organization);
    await this.assertActiveSubscription(organizationId);
    return organization;
  }

  /**
   * Login + consulta / exportación (permite org suspendida).
   */
  async assertLoginAccess(organizationId) {
    const organization = await this.assertOrganizationExists(organizationId);
    await this.assertOrganizationReadable(organization);
    await this.assertReadableSubscription(organizationId);
    return organization;
  }

  /**
   * Alias explícito para rutas de solo lectura.
   */
  async assertReadAccess(organizationId) {
    return this.assertLoginAccess(organizationId);
  }

  isPlatformUser(roleName) {
    return roleName === ROLES.SUPER_ADMIN;
  }

  isWriteBlocked(organizationStatus) {
    return organizationStatus === 'suspended';
  }
}

export const organizationAccessService = new OrganizationAccessService();
