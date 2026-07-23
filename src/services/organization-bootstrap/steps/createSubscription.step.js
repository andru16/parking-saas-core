import { BootstrapStep } from './bootstrapStep.js';
import { subscriptionService } from '#services/saas-billing/subscription.service.js';

export class CreateSubscriptionStep extends BootstrapStep {
  constructor() {
    super('createSubscription');
  }

  async execute(context, session) {
    const plan = context.plan;
    const isTrialPlan = Boolean(plan?.isTrialPlan || plan?.code === 'trial');
    const mode =
      context.input.subscriptionMode ||
      (isTrialPlan ? 'trial' : 'awaiting_activation');

    const subscription = await subscriptionService.createInitial(
      context.organization._id,
      plan,
      {
        session,
        actorUserId: context.responsibleUserId ?? context.adminUser?._id ?? null,
        mode,
      },
    );

    context.subscription = subscription;
  }
}
