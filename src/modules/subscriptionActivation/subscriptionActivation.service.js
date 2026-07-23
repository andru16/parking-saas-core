import Organization from '#modules/organization/organization.model.js';
import { ApiError } from '#utils/ApiError.js';
import { subscriptionService } from '#services/saas-billing/subscription.service.js';
import { planService } from '#services/saas-billing/plan.service.js';
import { settingsService } from '#modules/systemSettings/settings.service.js';
import { emailService } from '#services/email/email.service.js';
import SubscriptionHistory from '#modules/subscription/subscriptionHistory.model.js';
import SubscriptionActivationRequest, {
  ACTIVATION_REQUEST_STATUSES,
} from './subscriptionActivationRequest.model.js';
import { activationNotifications } from './activation.notifications.js';
import env from '#config/env.js';

const STATUS_LABELS = Object.freeze({
  PENDING: 'Pendiente',
  IN_REVIEW: 'En revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
});

/**
 * Solicitudes de activación de suscripción (flujo manual pre-pasarela).
 */
export class SubscriptionActivationService {
  getMeta() {
    return {
      statuses: ACTIVATION_REQUEST_STATUSES.map((id) => ({
        id,
        label: STATUS_LABELS[id] ?? id,
      })),
    };
  }

  async getSupportContact() {
    return settingsService.getSupportContact();
  }

  async getWelcomeContext(organizationId) {
    const org = await Organization.findById(organizationId)
      .populate('intendedPlanId')
      .lean();
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    const summary = await subscriptionService.getSummaryForOrganization(organizationId);
    const saas = await settingsService.getSaasDefaults();
    const support = await this.getSupportContact();

    let plan = summary.plan;
    if (!plan && org.intendedPlanId) {
      const p = org.intendedPlanId;
      plan = {
        id: p._id.toString(),
        name: p.name,
        code: p.code,
        color: p.color,
        isTrialPlan: p.isTrialPlan,
        priceMonthly: p.pricing?.monthly ?? p.price ?? null,
        features:
          p.features instanceof Map
            ? Object.fromEntries(p.features)
            : { ...(p.features || {}) },
        limits: p.limits ?? {},
      };
    }

    const openRequest = await SubscriptionActivationRequest.findOne({
      organizationId,
      status: { $in: ['PENDING', 'IN_REVIEW'] },
    })
      .sort({ createdAt: -1 })
      .populate('planId', 'name code color priceMonthly')
      .lean();

    return {
      organization: {
        id: org._id.toString(),
        name: org.name,
        status: org.status,
        city: org.city,
        phone: org.phone,
        email: org.email,
      },
      subscription: summary,
      plan,
      trialPremiumDays: saas.trialPremiumDays,
      support,
      openActivationRequest: openRequest ? this.#serialize(openRequest) : null,
    };
  }

  async startPremiumTrial(organizationId, userId) {
    const subscription = await subscriptionService.startPremiumTrial(organizationId, userId);
    const summary = await subscriptionService.getSummaryForOrganization(organizationId);
    return { subscription, summary };
  }

  async createRequest(organizationId, userId, payload) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organización no encontrada');

    const summary = await subscriptionService.getSummaryForOrganization(organizationId);
    const planId = org.intendedPlanId || summary.plan?.id;
    if (!planId) {
      throw new ApiError(400, 'No hay un plan seleccionado para activar');
    }

    const plan = await planService.resolveActivePlanById(planId);

    const open = await SubscriptionActivationRequest.findOne({
      organizationId,
      status: { $in: ['PENDING', 'IN_REVIEW'] },
    }).lean();

    if (open) {
      throw new ApiError(409, 'Ya tienes una solicitud de activación en proceso', {
        code: 'ACTIVATION_REQUEST_EXISTS',
        requestId: open._id,
      });
    }

    const doc = await SubscriptionActivationRequest.create({
      organizationId,
      userId,
      planId: plan._id,
      company: payload.company,
      contactName: payload.contactName,
      email: payload.email,
      phone: payload.phone,
      city: payload.city,
      dailyVehicles: payload.dailyVehicles ?? null,
      branches: payload.branches ?? 1,
      schedule: payload.schedule ?? null,
      comments: payload.comments ?? null,
      status: 'PENDING',
    });

    await SubscriptionHistory.create({
      organizationId,
      subscriptionId: null,
      fromPlanId: plan._id,
      toPlanId: plan._id,
      action: 'activation_requested',
      actorUserId: userId,
      notes: 'Solicitud de activación enviada',
      metadata: { requestId: doc._id },
    });

    const support = await this.getSupportContact();
    const populated = await this.#populate(doc);

    await activationNotifications.requestCreated({
      organizationId,
      organizationName: org.name,
      request: populated,
      planName: plan.name,
      actorUserId: userId,
    });

    const adminRecipients = this.#resolveAdminNotifyEmails(support.email);

    // Correos: no bloquear si fallan (flujo manual).
    await Promise.allSettled([
      emailService.sendActivationRequestReceived({
        to: doc.email,
        contactName: doc.contactName,
        planName: plan.name,
        company: doc.company,
      }),
      ...adminRecipients.map((to) =>
        emailService.sendActivationRequestToAdmin({
          to,
          request: populated,
          planName: plan.name,
          organizationName: org.name,
        }),
      ),
    ]);

    return populated;
  }

  /**
   * Destinatarios del aviso al equipo (soporte + super admin si el correo es usable).
   */
  #resolveAdminNotifyEmails(supportEmail) {
    const emails = new Set();
    const add = (value) => {
      const email = String(value || '')
        .trim()
        .toLowerCase();
      if (!email || !email.includes('@')) return;
      if (email.endsWith('.local')) return;
      emails.add(email);
    };

    add(supportEmail);
    add(env.superAdmin?.email);
    add(process.env.ACTIVATION_ADMIN_EMAIL);

    return [...emails];
  }

  async listForOrganization(organizationId, { page = 1, limit = 20 } = {}) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const filter = { organizationId };

    const [items, total] = await Promise.all([
      SubscriptionActivationRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .populate('planId', 'name code color priceMonthly')
        .lean(),
      SubscriptionActivationRequest.countDocuments(filter),
    ]);

    return {
      items: items.map((r) => this.#serialize(r)),
      pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) || 1 },
    };
  }

  async listAll({
    page = 1,
    limit = 20,
    status,
    search,
    sort = 'createdAt',
    order = 'desc',
  } = {}) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const filter = {};

    if (status && ACTIVATION_REQUEST_STATUSES.includes(status)) {
      filter.status = status;
    }

    if (search?.trim()) {
      const q = search.trim();
      filter.$or = [
        { company: new RegExp(q, 'i') },
        { contactName: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
        { city: new RegExp(q, 'i') },
      ];
    }

    const sortField = ['createdAt', 'status', 'company', 'updatedAt'].includes(sort)
      ? sort
      : 'createdAt';
    const sortDir = order === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      SubscriptionActivationRequest.find(filter)
        .sort({ [sortField]: sortDir })
        .skip((p - 1) * l)
        .limit(l)
        .populate('planId', 'name code color priceMonthly')
        .populate('organizationId', 'name city status')
        .populate('userId', 'firstName lastName email')
        .lean(),
      SubscriptionActivationRequest.countDocuments(filter),
    ]);

    return {
      items: items.map((r) => this.#serialize(r)),
      pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) || 1 },
    };
  }

  async getOne(requestId, { organizationId = null } = {}) {
    const filter = { _id: requestId };
    if (organizationId) filter.organizationId = organizationId;

    const doc = await SubscriptionActivationRequest.findOne(filter)
      .populate('planId', 'name code color priceMonthly limits features')
      .populate('organizationId', 'name city status phone email')
      .populate('userId', 'firstName lastName email phone')
      .populate('reviewedByUserId', 'firstName lastName email')
      .lean();

    if (!doc) throw new ApiError(404, 'Solicitud no encontrada');
    return this.#serialize(doc);
  }

  async setStatus(requestId, { status, adminNotes, actorUserId }) {
    if (!['IN_REVIEW', 'PENDING'].includes(status)) {
      throw new ApiError(400, 'Usa approve/reject para estados finales');
    }

    const doc = await SubscriptionActivationRequest.findById(requestId);
    if (!doc) throw new ApiError(404, 'Solicitud no encontrada');
    if (['APPROVED', 'REJECTED'].includes(doc.status)) {
      throw new ApiError(400, 'La solicitud ya fue cerrada');
    }

    doc.status = status;
    if (adminNotes != null) doc.adminNotes = adminNotes;
    doc.reviewedByUserId = actorUserId;
    doc.reviewedAt = new Date();
    await doc.save();

    return this.getOne(requestId);
  }

  async approve(requestId, { startDate, endDate, adminNotes, actorUserId }) {
    const doc = await SubscriptionActivationRequest.findById(requestId);
    if (!doc) throw new ApiError(404, 'Solicitud no encontrada');
    if (doc.status === 'APPROVED') {
      throw new ApiError(400, 'La solicitud ya fue aprobada');
    }
    if (doc.status === 'REJECTED') {
      throw new ApiError(400, 'La solicitud fue rechazada');
    }

    if (!startDate || !endDate) {
      throw new ApiError(400, 'Debes indicar fecha de inicio y vencimiento');
    }

    await subscriptionService.activateFromRequest(doc.organizationId, {
      planId: doc.planId,
      startDate,
      endDate,
      notes: adminNotes || '',
      actorUserId,
    });

    doc.status = 'APPROVED';
    doc.adminNotes = adminNotes ?? doc.adminNotes;
    doc.reviewedByUserId = actorUserId;
    doc.reviewedAt = new Date();
    doc.activationStartDate = new Date(startDate);
    doc.activationEndDate = new Date(endDate);
    await doc.save();

    const plan = await planService.resolveActivePlanById(doc.planId);
    const support = await this.getSupportContact();

    await activationNotifications.requestApproved({
      organizationId: doc.organizationId,
      planName: plan.name,
      actorUserId,
    });

    await Promise.allSettled([
      emailService.sendActivationApproved({
        to: doc.email,
        contactName: doc.contactName,
        planName: plan.name,
        startDate: doc.activationStartDate,
        endDate: doc.activationEndDate,
        supportEmail: support.email,
      }),
    ]);

    return this.getOne(requestId);
  }

  async reject(requestId, { adminNotes, actorUserId }) {
    const doc = await SubscriptionActivationRequest.findById(requestId);
    if (!doc) throw new ApiError(404, 'Solicitud no encontrada');
    if (['APPROVED', 'REJECTED'].includes(doc.status)) {
      throw new ApiError(400, 'La solicitud ya fue cerrada');
    }

    doc.status = 'REJECTED';
    doc.adminNotes = adminNotes ?? doc.adminNotes;
    doc.reviewedByUserId = actorUserId;
    doc.reviewedAt = new Date();
    await doc.save();

    await SubscriptionHistory.create({
      organizationId: doc.organizationId,
      subscriptionId: null,
      fromPlanId: doc.planId,
      toPlanId: doc.planId,
      action: 'activation_rejected',
      actorUserId,
      notes: adminNotes || 'Solicitud rechazada',
      metadata: { requestId: doc._id },
    });

    const support = await this.getSupportContact();
    const plan = await planService.resolveActivePlanById(doc.planId).catch(() => null);

    await activationNotifications.requestRejected({
      organizationId: doc.organizationId,
      planName: plan?.name || 'tu plan',
      actorUserId,
      reason: adminNotes || null,
    });

    await Promise.allSettled([
      emailService.sendActivationRejected({
        to: doc.email,
        contactName: doc.contactName,
        planName: plan?.name || 'tu plan',
        supportEmail: support.email,
        supportWhatsapp: support.whatsapp,
        reason: adminNotes || null,
      }),
    ]);

    return this.getOne(requestId);
  }

  async #populate(doc) {
    const lean =
      typeof doc.toObject === 'function'
        ? doc.toObject()
        : doc;
    const full = await SubscriptionActivationRequest.findById(lean._id)
      .populate('planId', 'name code color priceMonthly')
      .populate('organizationId', 'name city status')
      .populate('userId', 'firstName lastName email')
      .lean();
    return this.#serialize(full);
  }

  #serialize(r) {
    if (!r) return null;
    const plan = r.planId;
    const org = r.organizationId;
    const user = r.userId;
    const reviewer = r.reviewedByUserId;

    return {
      id: r._id.toString(),
      organizationId:
        org?._id?.toString?.() || org?.toString?.() || r.organizationId?.toString?.(),
      organization: org?._id
        ? {
            id: org._id.toString(),
            name: org.name,
            city: org.city,
            status: org.status,
            phone: org.phone,
            email: org.email,
          }
        : null,
      userId: user?._id?.toString?.() || user?.toString?.() || r.userId?.toString?.(),
      user: user?._id
        ? {
            id: user._id.toString(),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
          }
        : null,
      planId: plan?._id?.toString?.() || plan?.toString?.() || r.planId?.toString?.(),
      plan: plan?._id
        ? {
            id: plan._id.toString(),
            name: plan.name,
            code: plan.code,
            color: plan.color,
            priceMonthly: plan.pricing?.monthly ?? plan.priceMonthly ?? plan.price ?? null,
            limits: plan.limits,
            features:
              plan.features instanceof Map
                ? Object.fromEntries(plan.features)
                : plan.features,
          }
        : null,
      company: r.company,
      contactName: r.contactName,
      email: r.email,
      phone: r.phone,
      city: r.city,
      dailyVehicles: r.dailyVehicles,
      branches: r.branches,
      schedule: r.schedule,
      comments: r.comments,
      status: r.status,
      statusLabel: STATUS_LABELS[r.status] ?? r.status,
      adminNotes: r.adminNotes,
      reviewedBy: reviewer?._id
        ? {
            id: reviewer._id.toString(),
            firstName: reviewer.firstName,
            lastName: reviewer.lastName,
            email: reviewer.email,
          }
        : null,
      reviewedAt: r.reviewedAt,
      activationStartDate: r.activationStartDate,
      activationEndDate: r.activationEndDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export const subscriptionActivationService = new SubscriptionActivationService();
