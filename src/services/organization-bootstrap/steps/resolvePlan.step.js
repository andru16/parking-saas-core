import { BootstrapStep } from './bootstrapStep.js';
import { resolveOrganizationStatus } from '../utils/subscriptionDates.js';

export class ResolvePlanStep extends BootstrapStep {
  constructor(planService) {
    super('resolvePlan');
    this.planService = planService;
  }

  async execute(context, session) {
    if (context.input.planCode && !context.input.planId) {
      context.plan = await this.planService.resolvePlanByCode(context.input.planCode, session);
      context.organizationStatus = resolveOrganizationStatus(context.plan);
      return;
    }
    context.plan = await this.planService.resolvePlan(context.input.planId, session);
    context.organizationStatus = resolveOrganizationStatus(context.plan);
  }
}
