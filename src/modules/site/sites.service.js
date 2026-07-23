import Site from '#modules/site/site.model.js';
import Organization from '#modules/organization/organization.model.js';
import CashPoint from '#modules/cashPoint/cashPoint.model.js';
import { ApiError } from '#utils/ApiError.js';
import { planLimitsService } from '#services/saas-billing/planLimits.service.js';
import { auditService } from '#services/audit/audit.service.js';

export const SITE_AUDIT = Object.freeze({
  CREATED: 'site_created',
  UPDATED: 'site_updated',
  DEACTIVATED: 'site_deactivated',
});

export class SitesService {
  /**
   * Garantiza una sede primaria a partir de los datos de la organización.
   */
  async ensurePrimarySite(organizationId) {
    const existing = await Site.findOne({ organizationId, isPrimary: true });
    if (existing) return existing;

    const any = await Site.findOne({ organizationId }).sort({ createdAt: 1 });
    if (any) {
      any.isPrimary = true;
      await any.save();
      return any;
    }

    const org = await Organization.findById(organizationId)
      .select('name address city')
      .lean();

    const [created] = await Site.create([
      {
        organizationId,
        name: org?.name ? `${org.name} — Sede principal` : 'Sede principal',
        code: 'MAIN',
        address: org?.address ?? null,
        city: org?.city ?? null,
        isPrimary: true,
        status: 'active',
      },
    ]);

    return created;
  }

  async list(organizationId) {
    await this.ensurePrimarySite(organizationId);
    const sites = await Site.find({ organizationId }).sort({ isPrimary: -1, name: 1 }).lean();
    return sites.map((s) => this.#toResponse(s));
  }

  async getById(organizationId, siteId) {
    const site = await Site.findOne({ _id: siteId, organizationId }).lean();
    if (!site) throw new ApiError(404, 'Sede no encontrada');
    return this.#toResponse(site);
  }

  async create(organizationId, actorUserId, payload, auditContext = {}) {
    await planLimitsService.assertCanAddSite(organizationId);

    const name = payload.name?.trim();
    if (!name) throw new ApiError(400, 'El nombre es obligatorio');

    const dup = await Site.findOne({ organizationId, name }).collation({
      locale: 'en',
      strength: 2,
    });
    if (dup) throw new ApiError(409, 'Ya existe una sede con ese nombre');

    const site = await Site.create({
      organizationId,
      name,
      code: payload.code?.trim() || null,
      address: payload.address?.trim() || null,
      city: payload.city?.trim() || null,
      isPrimary: false,
      status: payload.status === 'inactive' ? 'inactive' : 'active',
    });

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: 'sites',
      action: SITE_AUDIT.CREATED,
      description: `Sede creada: ${name}`,
      resourceId: site._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.#toResponse(site.toObject());
  }

  async update(organizationId, actorUserId, siteId, payload, auditContext = {}) {
    const site = await Site.findOne({ _id: siteId, organizationId });
    if (!site) throw new ApiError(404, 'Sede no encontrada');

    if (payload.name != null) {
      const name = payload.name.trim();
      if (!name) throw new ApiError(400, 'El nombre es obligatorio');
      const dup = await Site.findOne({
        organizationId,
        name,
        _id: { $ne: site._id },
      }).collation({ locale: 'en', strength: 2 });
      if (dup) throw new ApiError(409, 'Ya existe una sede con ese nombre');
      site.name = name;
    }

    if (payload.code !== undefined) site.code = payload.code?.trim() || null;
    if (payload.address !== undefined) site.address = payload.address?.trim() || null;
    if (payload.city !== undefined) site.city = payload.city?.trim() || null;

    if (payload.status && ['active', 'inactive'].includes(payload.status)) {
      if (site.isPrimary && payload.status === 'inactive') {
        throw new ApiError(400, 'No se puede desactivar la sede principal');
      }
      site.status = payload.status;
    }

    await site.save();

    await auditService.log({
      userId: actorUserId,
      organizationId,
      module: 'sites',
      action: SITE_AUDIT.UPDATED,
      description: `Sede actualizada: ${site.name}`,
      resourceId: site._id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
    });

    return this.#toResponse(site.toObject());
  }

  /**
   * Resuelve siteId para un punto de caja (prioriza el enviado o la sede primaria).
   */
  async resolveSiteIdForCashPoint(organizationId, siteId) {
    if (siteId) {
      const site = await Site.findOne({
        _id: siteId,
        organizationId,
        status: 'active',
      }).select('_id');
      if (!site) throw new ApiError(400, 'Sede inválida o inactiva');
      return site._id;
    }

    const primary = await this.ensurePrimarySite(organizationId);
    return primary._id;
  }

  async countCashPointsForSite(organizationId, siteId) {
    return CashPoint.countDocuments({ organizationId, siteId });
  }

  #toResponse(site) {
    return {
      id: site._id.toString(),
      name: site.name,
      code: site.code ?? null,
      address: site.address ?? null,
      city: site.city ?? null,
      isPrimary: Boolean(site.isPrimary),
      status: site.status,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    };
  }
}

export const sitesService = new SitesService();
