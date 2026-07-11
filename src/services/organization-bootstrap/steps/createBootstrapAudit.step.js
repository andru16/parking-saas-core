import { auditService } from '#services/audit/audit.service.js';
import {
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  AUDIT_USER_TYPES,
} from '#services/audit/audit.events.js';
import { BootstrapStep } from './bootstrapStep.js';

export class CreateBootstrapAuditStep extends BootstrapStep {
  constructor() {
    super('createBootstrapAudit');
  }

  async execute(context, session) {
    const { auditContext = {} } = context.input;

    await auditService.log(
      {
        userId: context.getAuditUserId(),
        organizationId: context.organization._id,
        userType: context.getAuditUserId()
          ? AUDIT_USER_TYPES.ORGANIZATION_USER
          : AUDIT_USER_TYPES.SYSTEM,
        module: AUDIT_MODULES.ORGANIZATIONS,
        action: 'create',
        description: 'Organization created',
        entityType: AUDIT_ENTITY_TYPES.ORGANIZATION,
        entityId: context.organization._id,
        ip: auditContext.ip || null,
        userAgent: auditContext.userAgent || null,
        newValues: {
          name: context.organization.name,
          status: context.organization.status,
          planCode: context.plan.code,
        },
        metadata: {
          origin: context.input.origin,
          organizationName: context.organization.name,
          planCode: context.plan.code,
          planId: context.plan._id,
          adminUserId: context.adminUser._id,
          subscriptionId: context.subscription._id,
          ...context.input.auditContext?.metadata,
        },
      },
      { session, throwOnError: true },
    );
  }
}
