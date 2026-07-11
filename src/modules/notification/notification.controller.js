import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { getRequestContext } from '#modules/auth/auth.helpers.js';
import { ApiError } from '#utils/ApiError.js';
import { notificationService } from '#services/notifications/notification.service.js';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENTS,
  NOTIFICATION_TYPES,
} from '#services/notifications/notification.events.js';

function parseBool(value) {
  return value === true || value === 'true' || value === '1';
}

function orgAudience(req) {
  if (!req.auth?.organizationId || !req.auth?.userId) {
    throw new ApiError(403, 'Contexto de organización requerido');
  }
  return {
    organizationId: req.auth.organizationId,
    userId: req.auth.userId,
    platform: false,
  };
}

function platformAudience(req) {
  const userId = req.platformAuth?.userId ?? req.auth?.userId;
  if (!userId) throw new ApiError(401, 'No autenticado');
  return {
    organizationId: null,
    userId,
    platform: true,
  };
}

function listFilters(query) {
  return {
    search: query.search,
    type: query.type,
    category: query.category,
    priority: query.priority,
    unreadOnly: parseBool(query.unreadOnly),
  };
}

/** ——— Tenant ——— */

export const listOrgNotifications = catchAsync(async (req, res) => {
  const result = await notificationService.list(orgAudience(req), listFilters(req.query), {
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 25,
  });
  sendSuccess(res, { data: result });
});

export const unreadOrgCount = catchAsync(async (req, res) => {
  const data = await notificationService.countUnread(orgAudience(req));
  sendSuccess(res, { data });
});

export const metaOrgNotifications = catchAsync(async (_req, res) => {
  sendSuccess(res, { data: await notificationService.getMeta() });
});

export const getOrgNotification = catchAsync(async (req, res) => {
  const item = await notificationService.getById(req.params.notificationId, orgAudience(req));
  sendSuccess(res, { data: { item } });
});

export const createOrgNotification = catchAsync(async (req, res) => {
  const message = req.body.message ?? req.body.body;
  if (!message) throw new ApiError(400, 'message es obligatorio');

  const targetUserId = req.body.userId ?? null;
  if (targetUserId) {
    const User = (await import('#modules/user/user.model.js')).default;
    const target = await User.findOne({
      _id: targetUserId,
      organizationId: req.auth.organizationId,
    })
      .select('_id')
      .lean();
    if (!target) {
      throw new ApiError(400, 'El usuario destino no pertenece a esta organización');
    }
  }

  const items = await notificationService.create(
    {
      organizationId: req.auth.organizationId,
      userId: targetUserId,
      title: req.body.title,
      message,
      type: req.body.type || NOTIFICATION_TYPES.INFO,
      category: req.body.category || NOTIFICATION_CATEGORIES.SYSTEM,
      priority: req.body.priority,
      event: req.body.event || NOTIFICATION_EVENTS.MANUAL,
      actionUrl: req.body.actionUrl ?? null,
      metadata: req.body.metadata ?? {},
    },
    {
      actorUserId: req.auth.userId,
      auditContext: getRequestContext(req),
    },
  );

  sendSuccess(res, {
    statusCode: 201,
    message: 'Notificación creada',
    data: { items },
  });
});

export const markOrgRead = catchAsync(async (req, res) => {
  const item = await notificationService.markRead(req.params.notificationId, orgAudience(req), {
    actorUserId: req.auth.userId,
    auditContext: getRequestContext(req),
  });
  sendSuccess(res, { message: 'Marcada como leída', data: { item } });
});

export const markOrgAllRead = catchAsync(async (req, res) => {
  const result = await notificationService.markAllRead(orgAudience(req), {
    actorUserId: req.auth.userId,
    auditContext: getRequestContext(req),
  });
  sendSuccess(res, { message: 'Todas marcadas como leídas', data: result });
});

export const deleteOrgNotification = catchAsync(async (req, res) => {
  const result = await notificationService.remove(req.params.notificationId, orgAudience(req), {
    actorUserId: req.auth.userId,
    auditContext: getRequestContext(req),
  });
  sendSuccess(res, { message: 'Notificación eliminada', data: result });
});

/** ——— Super Admin (plataforma) ——— */

export const listPlatformNotifications = catchAsync(async (req, res) => {
  const result = await notificationService.list(platformAudience(req), listFilters(req.query), {
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 25,
  });
  sendSuccess(res, { data: result });
});

export const unreadPlatformCount = catchAsync(async (req, res) => {
  const data = await notificationService.countUnread(platformAudience(req));
  sendSuccess(res, { data });
});

export const metaPlatformNotifications = catchAsync(async (_req, res) => {
  sendSuccess(res, { data: await notificationService.getMeta() });
});

export const getPlatformNotification = catchAsync(async (req, res) => {
  const item = await notificationService.getById(
    req.params.notificationId,
    platformAudience(req),
  );
  sendSuccess(res, { data: { item } });
});

export const createPlatformNotification = catchAsync(async (req, res) => {
  const message = req.body.message ?? req.body.body;
  if (!message) throw new ApiError(400, 'message es obligatorio');

  const items = await notificationService.create(
    {
      organizationId: null,
      userId: req.body.userId ?? null,
      title: req.body.title,
      message,
      type: req.body.type || NOTIFICATION_TYPES.SYSTEM,
      category: req.body.category || NOTIFICATION_CATEGORIES.SUPER_ADMIN,
      priority: req.body.priority,
      event: req.body.event || NOTIFICATION_EVENTS.SYSTEM_ANNOUNCEMENT,
      actionUrl: req.body.actionUrl ?? null,
      metadata: req.body.metadata ?? {},
    },
    {
      actorUserId: req.platformAuth.userId,
      auditContext: getRequestContext(req),
    },
  );

  sendSuccess(res, {
    statusCode: 201,
    message: 'Notificación de plataforma creada',
    data: { items },
  });
});

export const markPlatformRead = catchAsync(async (req, res) => {
  const item = await notificationService.markRead(
    req.params.notificationId,
    platformAudience(req),
    {
      actorUserId: req.platformAuth.userId,
      auditContext: getRequestContext(req),
    },
  );
  sendSuccess(res, { message: 'Marcada como leída', data: { item } });
});

export const markPlatformAllRead = catchAsync(async (req, res) => {
  const result = await notificationService.markAllRead(platformAudience(req), {
    actorUserId: req.platformAuth.userId,
    auditContext: getRequestContext(req),
  });
  sendSuccess(res, { message: 'Todas marcadas como leídas', data: result });
});

export const deletePlatformNotification = catchAsync(async (req, res) => {
  const result = await notificationService.remove(
    req.params.notificationId,
    platformAudience(req),
    {
      actorUserId: req.platformAuth.userId,
      auditContext: getRequestContext(req),
    },
  );
  sendSuccess(res, { message: 'Notificación eliminada', data: result });
});
