import { ApiError } from '#utils/ApiError.js';
import { orgUsersService } from '#modules/users/orgUsers.service.js';
import { orgRolesService } from '#modules/users/orgRoles.service.js';
import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';

/**
 * Sección legacy del Settings Center.
 * La UI de Usuarios/Roles usa `/api/users`; aquí solo lectura compatible.
 */
export class UsersSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.USERS, {
      label: 'Usuarios y roles',
      description:
        'Gestión completa en /settings/users y /settings/roles (API /api/users).',
    });
  }

  async get(context) {
    const [users, roles] = await Promise.all([
      orgUsersService.list(context.organizationId),
      orgRolesService.list(context.organizationId),
    ]);

    return {
      users,
      roles,
      managedVia: '/api/users',
    };
  }

  async save() {
    throw new ApiError(
      400,
      'La gestión de usuarios y roles se realiza en /api/users (pantallas Usuarios y Roles)',
    );
  }
}
