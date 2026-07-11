import Role from '#modules/role/role.model.js';
import { ApiError } from '#utils/ApiError.js';
import { BootstrapStep } from './bootstrapStep.js';
import { rbacService } from '#services/rbac/rbac.service.js';

/**
 * Crea roles RBAC de la Organization (Administrador, Supervisor, Cajero).
 */
export class AssignOrganizationRolesStep extends BootstrapStep {
  constructor() {
    super('assignOrganizationRoles');
  }

  async execute(context, session) {
    const roles = await rbacService.ensureDefaultRoles(context.organization._id, session);
    const adminRole = roles.find((r) => r.key === 'admin');

    if (!adminRole) {
      throw new ApiError(500, 'No se pudo crear el rol Administrador');
    }

    context.adminOrganizationRole = adminRole;
    context.organizationRoles = roles;

    // Mantener referencia al Role global solo para compatibilidad de seeds/plataforma.
    const globalAdmin = await Role.findOne({ name: 'organization_admin' }).session(session);
    context.adminRole = globalAdmin;
  }
}
