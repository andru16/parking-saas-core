import { BootstrapStep } from './bootstrapStep.js';
import { subscriptionService } from '#services/saas-billing/subscription.service.js';

export class CreateSubscriptionStep extends BootstrapStep {
  constructor() {
    super('createSubscription');
  }

  async execute(context, session) {
    const subscription = await subscriptionService.createInitial(
      context.organization._id,
      context.plan,
      {
        session,
        actorUserId: context.responsibleUserId ?? context.adminUser?._id ?? null,
      },
    );

    context.subscription = subscription;
  }
}
