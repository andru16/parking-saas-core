import { catchAsync } from '#utils/catchAsync.js';
import { auditService } from '#services/audit/audit.service.js';
import { AUDIT_RESULTS } from '#services/audit/audit.events.js';

/**
 * Middleware / helpers para auditar sin repetir lógica en cada controlador.
 *
 * Uso:
 *   router.post('/x', authenticate, auditAfter({ module: 'users', action: 'user_created', ... }), handler)
 *
 * O envolver un handler:
 *   catchAsync(withAudit(async (req, res) => { ... }, { module, action, getDescription }))
 */

/**
 * Registra auditoría al finalizar la respuesta con éxito (status < 400).
 * No bloquea la respuesta si el log falla.
 */
export function auditAfter(config = {}) {
  return (req, res, next) => {
    const started = Date.now();
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      res.locals.__auditBody = body;
      return originalJson(body);
    };

    res.on('finish', () => {
      const success = res.statusCode < 400;
      const result = success ? AUDIT_RESULTS.SUCCESS : AUDIT_RESULTS.ERROR;

      const description =
        typeof config.getDescription === 'function'
          ? config.getDescription(req, res)
          : config.description || `${config.action || 'action'} (${result})`;

      const entityId =
        typeof config.getEntityId === 'function'
          ? config.getEntityId(req, res)
          : config.entityId || null;

      // Fire-and-forget
      auditService
        .logFromRequest(req, {
          module: config.module,
          action: config.action,
          description: String(description).slice(0, 500),
          entityType: config.entityType || null,
          entityId,
          result,
          previousValues:
            typeof config.getPreviousValues === 'function'
              ? config.getPreviousValues(req, res)
              : config.previousValues ?? null,
          newValues:
            typeof config.getNewValues === 'function'
              ? config.getNewValues(req, res)
              : config.newValues ?? null,
          metadata: {
            statusCode: res.statusCode,
            durationMs: Date.now() - started,
            path: req.originalUrl,
            method: req.method,
            ...(typeof config.getMetadata === 'function'
              ? config.getMetadata(req, res)
              : config.metadata || {}),
          },
        })
        .catch(() => {});
    });

    next();
  };
}

/**
 * Envuelve un handler async y audita éxito / error.
 */
export function withAudit(handler, config = {}) {
  return catchAsync(async (req, res, next) => {
    try {
      const value = await handler(req, res, next);
      if (!res.headersSent) {
        // el handler puede haber respondido ya
      }
      await auditService.logFromRequest(req, {
        module: config.module,
        action: config.action,
        description:
          typeof config.getDescription === 'function'
            ? config.getDescription(req, res, null)
            : config.description || config.action,
        entityType: config.entityType,
        entityId:
          typeof config.getEntityId === 'function'
            ? config.getEntityId(req, res, null)
            : config.entityId,
        result: AUDIT_RESULTS.SUCCESS,
        previousValues:
          typeof config.getPreviousValues === 'function'
            ? config.getPreviousValues(req)
            : null,
        newValues:
          typeof config.getNewValues === 'function' ? config.getNewValues(req, value) : null,
      });
      return value;
    } catch (error) {
      await auditService.logFromRequest(req, {
        module: config.module,
        action: config.action || 'error',
        description:
          typeof config.getDescription === 'function'
            ? config.getDescription(req, null, error)
            : error.message || 'Error',
        entityType: config.entityType,
        result: AUDIT_RESULTS.ERROR,
        metadata: { errorName: error.name, statusCode: error.statusCode },
      });
      throw error;
    }
  });
}

/**
 * Adjunta helpers de auditoría en `req.audit`.
 */
export function attachAuditContext(req, _res, next) {
  req.audit = {
    log: (payload, options) => auditService.logFromRequest(req, payload, options),
    service: auditService,
  };
  next();
}
