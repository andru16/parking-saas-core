import { passwordService } from '#modules/auth/password.service.js';
import User from '#modules/user/user.model.js';
import { ApiError } from '#utils/ApiError.js';
import { BootstrapStep } from './bootstrapStep.js';

export class CreateAdminUserStep extends BootstrapStep {
  constructor() {
    super('createAdminUser');
  }

  async execute(context, session) {
    const { admin } = context.input;
    const email = admin.email.trim().toLowerCase();

    const existingUser = await User.findOne({ email }).session(session).select('_id');

    if (existingUser) {
      throw new ApiError(409, 'Ya existe un usuario registrado con este correo electrónico');
    }

    if (!context.adminOrganizationRole?._id) {
      throw new ApiError(500, 'Rol de organización administrador no disponible');
    }

    const hashedPassword = await passwordService.hash(admin.password);

    const [adminUser] = await User.create(
      [
        {
          firstName: admin.firstName.trim(),
          lastName: admin.lastName.trim(),
          email,
          phone: admin.phone?.trim() || null,
          password: hashedPassword,
          roleId: null,
          organizationRoleId: context.adminOrganizationRole._id,
          organizationId: context.organization._id,
          status: context.input.userStatus ?? 'active',
          emailVerified: context.input.userStatus === 'pending_verification' ? false : true,
        },
      ],
      { session },
    );

    context.adminUser = adminUser;
  }
}
