import { BootstrapStep } from './bootstrapStep.js';
import { resolveOrganizationStatus } from '../utils/subscriptionDates.js';

export class ResolvePlanStep extends BootstrapStep {
  constructor(planService) {
    super('resolvePlan');
    this.planService = planService;
  }

  async execute(context, session) {
    context.plan = await this.planService.resolvePlan(context.input.planId, session);
    context.organizationStatus = resolveOrganizationStatus(context.plan);
  }
}
