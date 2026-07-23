import Organization from '#modules/organization/organization.model.js';
import { BootstrapStep } from './bootstrapStep.js';

export class CreateOrganizationStep extends BootstrapStep {
  constructor() {
    super('createOrganization');
  }

  async execute(context, session) {
    const { organization: orgInput } = context.input;

    const [organization] = await Organization.create(
      [
        {
          name: orgInput.name.trim(),
          email: orgInput.email?.trim().toLowerCase() || undefined,
          phone: orgInput.phone?.trim() || undefined,
          city: orgInput.city?.trim() || undefined,
          stateOrDepartment: orgInput.stateOrDepartment?.trim() || undefined,
          country: orgInput.country?.trim() || undefined,
          taxId: orgInput.taxId?.trim() || undefined,
          address: orgInput.address?.trim() || undefined,
          status: context.input.organizationStatus ?? context.organizationStatus ?? 'trial',
          intendedPlanId: context.plan?._id ?? null,
          isSetupComplete: false,
        },
      ],
      { session },
    );

    context.organization = organization;
  }
}
